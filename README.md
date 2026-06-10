# DevAgent — AI Agent with Tool Calling

A production-quality **AI Agent REST API** built with **Express + Node.js + TypeScript**.
You send a natural-language prompt; the agent reasons over it with an LLM
(OpenAI `gpt-4o-mini`) and **autonomously calls tools in a loop** — searching the
web, querying a database, running code, doing math — until it produces a final
answer.

No LangChain, no agent framework. Just a raw, readable tool-calling loop you can
understand line by line.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Using the API](#using-the-api)
  - [With `request.http` (easiest)](#with-requesthttp-easiest)
  - [With `curl`](#with-curl)
- [API Reference](#api-reference)
- [Example Run](#example-run)
- [The Tools](#the-tools)
- [Database Schema](#database-schema)
- [Scripts](#scripts)
- [Design Notes](#design-notes)
- [Troubleshooting](#troubleshooting)

---

## Features

- 🔁 **Raw tool-calling loop** (`src/agent/agent.loop.ts`) — max 10 iterations, no magic.
- 🧰 **4 real tools**:
  - `web_search` — Tavily API (top 3 results, 5s timeout).
  - `db_query` — natural language → SQL → SQLite (SELECT-only, guarded).
  - `calculator` — `mathjs` expression evaluation.
  - `code_runner` — JavaScript in a `vm` sandbox (3s hard timeout).
- 📡 **Server-Sent Events** stream of every `tool_call` / `tool_result` / `final_answer`.
- 🗂️ **Run store** — poll status or replay the full step history any time.
- ✅ **Strict TypeScript**, Zod request + env validation, `pino` logging, graceful errors.

---

## How It Works

The agent is a **loop** around the OpenAI chat API. Each round, the model sees the
full conversation plus the list of available tools, and decides what to do next:

```
You ask  ─▶  LLM thinks  ─▶  "call a tool"  ─▶  tool runs  ─▶  result fed back
                 ▲                                                    │
                 └────────────────────  loop  ◀──────────────────────┘
                 (until the model answers in plain text instead of calling a tool)
```

The pieces that make this work:

| File | Role |
| ---- | ---- |
| `agent/tool.definitions.ts` | The **menu** handed to the model — JSON schemas describing each tool's name, purpose, and arguments. |
| `agent/agent.loop.ts` | The **brain** — calls OpenAI in a loop, runs whatever tools the model requests, feeds results back. Exits when the model replies without a tool call. |
| `agent/tool.dispatcher.ts` | The **switchboard** — maps a tool name to its implementation and runs it. Tool failures return `{ error }` instead of crashing the loop. |
| `agent/agent.runner.ts` | The **orchestrator** — runs the loop in the background so `POST /run` returns instantly, records every event to the store, and broadcasts events over an event bus to live SSE clients. |
| `store/run.store.ts` | In-memory `Map` of runs + their full event history (for `/status` and SSE replay). |

**Key idea:** the model signals it's *done* by responding with plain text (no
tool call). The loop also caps at 10 iterations as a safety net against runaway
loops.

---

## Project Structure

```
src/
├── server.ts                 # Express app bootstrap + health check
├── routes/agent.routes.ts    # All 4 API routes + SSE
├── agent/
│   ├── agent.loop.ts         # Core agent loop (talks to OpenAI)
│   ├── agent.runner.ts       # Background orchestration + SSE event bus
│   ├── tool.dispatcher.ts    # Routes tool calls to implementations
│   └── tool.definitions.ts   # OpenAI-compatible tool JSON schemas
├── tools/                    # web-search, db-query, calculator, code-runner
├── db/                       # node:sqlite client singleton + seed script
├── types/                    # Agent + Tool contracts
├── store/run.store.ts        # In-memory run store (Map)
├── middleware/               # error (asyncHandler) + validate middleware
└── config/                   # Zod env schema + pino logger
request.http                  # Ready-to-send example requests (REST Client)
```

---

## Prerequisites

- **Node.js 22.5+** — the database layer uses the built-in `node:sqlite` module
  (run behind the `--experimental-sqlite` flag, already wired into the `dev`,
  `seed`, and `start` scripts). No native compiler or prebuilt binary needed.
- An [OpenAI API key](https://platform.openai.com/)
- A [Tavily API key](https://tavily.com/) (free tier)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env       # then fill in your keys
#   OPENAI_API_KEY=sk-...
#   TAVILY_API_KEY=tvly-...
#   PORT=3001

# 3. Seed the SQLite database (users + orders mock data)
npm run seed

# 4. Run in dev mode (hot reload)
npm run dev

# ...or build + run for production
npm run build
npm start
```

The server validates all env vars at startup with Zod — if a key is missing it
**exits immediately** with a clear message rather than booting in a bad state.

---

## Using the API

The flow is always: **start a run → watch it (or poll it) → read the answer.**

### With `request.http` (easiest)

Install the **REST Client** VS Code extension (publisher: *Huachao Mao*), open
[`request.http`](./request.http), and click the **"Send Request"** link above any
block. The `runId` from a `POST /run` is captured automatically and reused by the
matching `/stream` and `/status` requests — no copy/paste needed.

### With `curl`

```bash
# 1) start a run, grab the runId from the response
curl -X POST http://localhost:3001/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"How many pro users do we have and what did they spend on paid orders?"}'
# → { "runId": "abc-123", "status": "running" }

# 2) watch it live (Server-Sent Events)
curl -N http://localhost:3001/api/agent/abc-123/stream

# 3) ...or just poll for the result
curl http://localhost:3001/api/agent/abc-123/status
```

> **Port note:** examples use `3001`. If that port is taken, set `PORT=3005`
> (or anything free) in `.env` and use that port in the URLs.

---

## API Reference

### `POST /api/agent/run`

Start a new agent run. Returns immediately; the agent works in the background.

**Body:** `{ "prompt": string }`
**Response:** `{ "runId": string, "status": "running" }`

### `GET /api/agent/:runId/stream`

SSE stream of the run. Events already emitted before you connect are replayed,
then live events follow until a terminal `done`.

```
data: {"type":"tool_call","tool":"db_query","args":{"query":"..."}}
data: {"type":"tool_result","tool":"db_query","result":{"sql":"...","rows":[...]}}
data: {"type":"final_answer","content":"..."}
data: {"type":"done"}
```

### `GET /api/agent/:runId/status`

Poll a run. `status` is `running` | `done` | `failed`.

```json
{ "runId": "abc-123", "status": "done", "finalAnswer": "…", "steps": [ ... ] }
```

### `GET /api/tools/list`

List the available tools and their descriptions.

### `GET /health`

Liveness check → `{ "status": "ok", "uptime": <seconds> }`.

---

## Example Run

**Prompt:** *"How many pro-plan users are there, and what is the sum of all paid
order amounts? Verify the sum with the calculator."*

The agent chains three tool calls on its own, then answers:

```
data: {"type":"tool_call","tool":"db_query","args":{"query":"How many users have the pro plan?"}}
data: {"type":"tool_result","tool":"db_query","result":{"sql":"SELECT COUNT(*) FROM users WHERE plan = 'pro'","rows":[{"COUNT(*)":4}]}}
data: {"type":"tool_call","tool":"db_query","args":{"query":"What is the sum of all paid order amounts?"}}
data: {"type":"tool_result","tool":"db_query","result":{"sql":"SELECT SUM(amount) FROM orders WHERE status = 'paid'","rows":[{"SUM(amount)":578.97}]}}
data: {"type":"tool_call","tool":"calculator","args":{"expression":"578.97"}}
data: {"type":"tool_result","tool":"calculator","result":{"result":578.97}}
data: {"type":"final_answer","content":"There are 4 users with the pro plan, and the sum of all paid order amounts is $578.97."}
data: {"type":"done"}
```

More prompts to try (each exercises a different tool):

- **calculator** — `"What is 1234 * 5678 divided by 3, rounded?"`
- **code_runner** — `"Write and run JS to return the first 10 Fibonacci numbers."`
- **db_query** — `"List all pro-plan users and how much they've spent on paid orders."`
- **web_search** — `"What is the latest LTS version of Node.js?"`
- **multi-tool** — `"What is the latest Node.js version, and how many days ago was it released?"`

---

## The Tools

| Tool | Args | What it does |
| ---- | ---- | ------------ |
| `web_search` | `{ query }` | Searches the web via Tavily; returns the top 3 `{title, url, content}`. 5s timeout via `AbortController`. |
| `db_query` | `{ query }` | Sends your English question + the schema to a **separate, tool-less** OpenAI call to generate SQL, enforces **SELECT-only**, runs it, returns `{ sql, rows }`. |
| `calculator` | `{ expression }` | Evaluates a math expression with `mathjs`. Invalid input returns `{ error }`. |
| `code_runner` | `{ code }` | Runs JS in a `vm.runInNewContext()` sandbox (3s hard timeout), captures `console.log`. Never uses `eval()`. |

Every tool implements the same contract (`src/types/tool.types.ts`):

```ts
export interface Tool {
  name: string;
  description: string;
  execute(args: Record<string, unknown>): Promise<unknown>;
}
```

---

## Database Schema

```
users(id, name, email, created_at, plan)         plan   ∈ {free, pro}
orders(id, user_id, amount, status, created_at)  status ∈ {pending, paid, refunded, cancelled}
```

`npm run seed` (re)creates both tables and loads 8 users + 12 orders of mock data.
`db_query` only ever issues **read-only SELECT** statements — anything else is rejected.

---

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Hot-reload dev server (`tsx watch`)  |
| `npm run build`     | Compile TypeScript to `dist/`        |
| `npm start`         | Run the compiled server              |
| `npm run seed`      | (Re)seed the SQLite database         |
| `npm run typecheck` | Type-check with no emit              |

---

## Design Notes

- **Loop cap:** the agent loop stops after **10 iterations**; exceeding it marks
  the run `failed` with a clear error (no infinite loops).
- **Resilient tools:** a tool failure returns `{ error }` as its result instead of
  throwing, so the model can see the failure and recover.
- **Safe code execution:** `code_runner` uses `vm.runInNewContext()` with an empty
  sandbox — never `eval()`.
- **Safe DB access:** `db_query` rejects anything that isn't a single `SELECT`.
- **No secrets in code:** all keys come from env, validated by Zod at startup.
- **Clean errors:** global error middleware returns `{ error, code }` — never a
  stack trace.
- **SQLite driver:** the spec named `better-sqlite3`, which needs a native build
  (C++ toolchain) or a prebuilt-binary download. This project uses Node's built-in
  `node:sqlite` instead — identical synchronous `prepare/all/run/exec` API, zero
  native dependencies, runs anywhere Node 22.5+ does.

---

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `EADDRINUSE: address already in use :::3001` | Another process owns the port. Set `PORT=3005` (or any free port) in `.env`. |
| Startup exits with `Invalid environment configuration` | A required key is missing/empty in `.env` — add `OPENAI_API_KEY` and `TAVILY_API_KEY`. |
| `SQLite is an experimental feature` warning | Harmless — `node:sqlite` is behind an experimental flag (already enabled by the scripts). |
| `db_query` returns an error about SELECT | The generated SQL wasn't a read-only `SELECT`; rephrase the prompt as a data question. |
| Agent run ends `failed` with "exceeded max iterations" | The model kept calling tools without converging; simplify or clarify the prompt. |
