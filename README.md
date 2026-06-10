# DevAgent — AI Agent with Tool Calling

A production-quality AI Agent REST API built with **Express + Node.js + TypeScript**.
The agent takes a natural-language prompt, reasons over it with an LLM (OpenAI
`gpt-4o-mini`), and autonomously calls tools in a loop until it produces a final
answer. No LangChain, no agent framework — just a raw, readable tool-calling loop.

## Features

- 🔁 **Raw tool-calling loop** (`src/agent/agent.loop.ts`) — max 10 iterations, no magic.
- 🧰 **4 real tools**:
  - `web_search` — Tavily API (top 3 results, 5s timeout).
  - `db_query` — natural language → SQL → SQLite (SELECT-only, guarded).
  - `calculator` — `mathjs` expression evaluation.
  - `code_runner` — JavaScript in a `vm` sandbox (3s hard timeout).
- 📡 **Server-Sent Events** stream of every `tool_call` / `tool_result` / `final_answer`.
- ✅ **Strict TypeScript**, Zod validation, Zod-validated env, `pino` logging.

## Project Structure

```
src/
├── server.ts                 # Express app bootstrap + health check
├── routes/agent.routes.ts    # All 4 API routes
├── agent/
│   ├── agent.loop.ts         # Core agent loop
│   ├── agent.runner.ts       # Background orchestration + SSE event bus
│   ├── tool.dispatcher.ts    # Routes tool calls to implementations
│   └── tool.definitions.ts   # OpenAI-compatible tool JSON schemas
├── tools/                    # web-search, db-query, calculator, code-runner
├── db/                       # SQLite client singleton + seed script
├── types/                    # Agent + Tool contracts
├── store/run.store.ts        # In-memory run store (Map)
├── middleware/               # error + validate middleware
└── config/                   # Zod env schema + pino logger
```

## Prerequisites

- **Node.js 22.5+** — the database layer uses the built-in `node:sqlite` module
  (run behind the `--experimental-sqlite` flag, which is already wired into the
  `dev`, `seed`, and `start` scripts). No native compiler or prebuilt binary needed.
- An [OpenAI API key](https://platform.openai.com/)
- A [Tavily API key](https://tavily.com/) (free tier)

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
**crashes immediately** with a clear message rather than booting in a bad state.

> **Port in use?** If `PORT=3001` is taken, set a different port in `.env` (e.g.
> `PORT=3005`) — the server reads `PORT` from the validated env.

> **Database driver note:** The spec named `better-sqlite3`, but that requires a
> native build (C++ toolchain) or a prebuilt-binary download. This project uses
> Node's built-in `node:sqlite` instead — identical synchronous
> `prepare/all/run/exec` API, zero native dependencies, runs anywhere Node 22.5+ does.

## API

### `POST /api/agent/run`

Start a new agent run.

```bash
curl -X POST http://localhost:3001/api/agent/run \
  -H "Content-Type: application/json" \
  -d '{"prompt":"How many pro users do we have and what is their total paid order amount?"}'
# → { "runId": "…", "status": "running" }
```

### `GET /api/agent/:runId/stream`

SSE stream of the run. Already-emitted events are replayed on connect, then live
events follow until a terminal `done`.

```bash
curl -N http://localhost:3001/api/agent/<runId>/stream
```

```
data: {"type":"tool_call","tool":"db_query","args":{"query":"..."}}
data: {"type":"tool_result","tool":"db_query","result":{"sql":"...","rows":[...]}}
data: {"type":"final_answer","content":"..."}
data: {"type":"done"}
```

### `GET /api/agent/:runId/status`

Poll the run.

```bash
curl http://localhost:3001/api/agent/<runId>/status
# → { "runId":"…","status":"done","finalAnswer":"…","steps":[...] }
```

### `GET /api/tools/list`

List available tools.

```bash
curl http://localhost:3001/api/tools/list
```

## Example prompts to test

Each exercises a different tool (or several):

- **calculator** — `"What is 1234 * 5678 divided by 3, rounded?"`
- **code_runner** — `"Write and run JS to return the first 10 Fibonacci numbers."`
- **db_query** — `"List all pro-plan users and how much they've spent on paid orders."`
- **web_search** — `"What is the latest LTS version of Node.js?"`
- **multi-tool** — `"What is the latest Node.js version, and how many days ago was it released?"`

## Database schema

```
users(id, name, email, created_at, plan)        plan ∈ {free, pro}
orders(id, user_id, amount, status, created_at)  status ∈ {pending, paid, refunded, cancelled}
```

`db_query` converts your natural-language question to SQL via a separate
tool-less LLM call, then enforces **SELECT-only** execution before touching SQLite.

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Hot-reload dev server (`tsx watch`)  |
| `npm run build`     | Compile TypeScript to `dist/`        |
| `npm start`         | Run compiled server                  |
| `npm run seed`      | (Re)seed the SQLite database         |
| `npm run typecheck` | Type-check with no emit              |

## Notes

- The agent loop caps at **10 iterations** to prevent runaway loops; exceeding it
  marks the run `failed` with a clear error.
- Tool failures never crash the loop — they return `{ error }` as the tool result
  so the model can recover.
- `code_runner` uses `vm.runInNewContext()` with an empty sandbox — never `eval()`.
