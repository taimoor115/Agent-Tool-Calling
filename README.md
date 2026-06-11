# DevAgent — AI Agent with Tool Calling

A production-quality **AI Agent REST API** built with **Express + Node.js + TypeScript**.
You send a natural-language prompt; the agent reasons over it with an LLM
(OpenAI `gpt-4o-mini`) and **autonomously calls tools in a loop** — searching the
web, querying a database, running code, doing math — until it produces a final
answer.

No LangChain, no agent framework. Just a raw, readable tool-calling loop you can
understand line by line.

It ships as a **monorepo** (npm workspaces + Turborepo) with two apps:

| App | Stack | What it is |
| --- | ----- | ---------- |
| **`apps/api`** | Express · TypeScript · OpenAI · `node:sqlite` | The agent REST API (the brain). |
| **`apps/web`** | Next.js 16 · React 19 · Tailwind CSS v4 | A web UI that streams the agent's tool calls live in your browser. |

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Monorepo Layout](#monorepo-layout)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [The Web UI](#the-web-ui)
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

- 🔁 **Raw tool-calling loop** (`apps/api/src/agent/agent.loop.ts`) — max 10 iterations, no magic.
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

## Monorepo Layout

```
agent-tool-calling/
├── package.json              # workspaces root + turbo scripts
├── turbo.json                # Turborepo task pipeline
├── request.http              # Ready-to-send API requests (REST Client)
└── apps/
    ├── api/                  # Express agent API  (@devagent/api)
    └── web/                  # Next.js 16 web UI  (@devagent/web)
```

Tooling: **npm workspaces** (dependency hoisting) + **Turborepo** (run/build both
apps with one command, with caching).

## Project Structure

```
apps/api/src/
├── server.ts                 # Express bootstrap + CORS + health check
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

apps/web/
├── app/                      # Next.js App Router (layout, page, globals.css)
├── components/               # PromptForm, ToolsList, EventStream, EventCard
├── hooks/useAgentRun.ts      # Drives a run + consumes the SSE stream
└── lib/                      # API client + shared event types
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

Run everything from the **repo root** — npm workspaces + Turborepo handle both apps.

```bash
# 1. Install all dependencies (api + web) from the root
npm install

# 2. Configure the API environment
cp apps/api/.env.example apps/api/.env    # then fill in your keys
#   OPENAI_API_KEY=sk-...
#   TAVILY_API_KEY=tvly-...
#   PORT=3001                              # API port
#   CORS_ORIGIN=*                          # or http://localhost:3000

# 3. Configure the web environment (point it at the API)
cp apps/web/.env.example apps/web/.env.local
#   NEXT_PUBLIC_API_URL=http://localhost:3001

# 4. Seed the SQLite database (users + orders mock data)
npm run seed

# 5. Run BOTH apps together (Turborepo)
npm run dev
#   → API  on http://localhost:3001
#   → Web  on http://localhost:3000

# ...or run just one
npm run dev:api      # API only
npm run dev:web      # web only

# Production build
npm run build
```

Open **http://localhost:3000** and start asking the agent questions.

The API validates all env vars at startup with Zod — if a key is missing it
**exits immediately** with a clear message rather than booting in a bad state.

> **Port conflict?** If `3001` is taken, set a different `PORT` in `apps/api/.env`
> **and** matching `NEXT_PUBLIC_API_URL` in `apps/web/.env.local`.

---

## The Web UI

The Next.js frontend (`apps/web`) is a live agent console:

- A **prompt box** (with example chips) that starts a run via `POST /api/agent/run`.
- A **live activity feed** that opens an `EventSource` to the SSE `/stream` endpoint
  and renders each `tool_call`, `tool_result`, and the `final_answer` as it arrives —
  colour-coded per tool, with auto-scroll and a run-status badge.
- A **tools panel** populated from `GET /api/tools/list`.

The streaming logic lives in [`apps/web/hooks/useAgentRun.ts`](./apps/web/hooks/useAgentRun.ts):
it POSTs the prompt, gets a `runId`, opens an `EventSource` to the stream, and
appends events to React state until the terminal `done`. The API client and shared
event types are in [`apps/web/lib`](./apps/web/lib).

> The browser talks to the API directly, so the API has **CORS** enabled
> (`apps/api/src/server.ts`, configurable via `CORS_ORIGIN`).

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

Every tool implements the same contract (`apps/api/src/types/tool.types.ts`):

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

Run these from the **repo root** (Turborepo fans them out to both apps):

| Script              | Description                                            |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Run **both** apps (API + web) with hot reload         |
| `npm run dev:api`   | Run only the API (`tsx watch`)                        |
| `npm run dev:web`   | Run only the web UI (`next dev`)                      |
| `npm run build`     | Build both apps (`tsc` + `next build`)               |
| `npm run typecheck` | Type-check both apps                                  |
| `npm run seed`      | (Re)seed the API's SQLite database                    |

Per-app scripts still work too, e.g. `npm run start --workspace @devagent/api`.

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
