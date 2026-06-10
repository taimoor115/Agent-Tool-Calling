# DevAgent — AI Agent with Tool Calling

## Claude Code Project Prompt

---

## Project Overview

Build a production-quality AI Agent REST API using **Express + Node.js + TypeScript**.
The agent accepts a natural language prompt, reasons over it using an LLM (OpenAI),
and executes tools autonomously in a loop until it produces a final answer.

This is a **learning-first project** — code must be clean, typed, and easy to follow.
No magic abstractions. No LangChain. Raw tool-calling loop only.

---

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript (strict mode)
- **Framework**: Express.js (no NestJS)
- **LLM**: OpenAI SDK (`openai`) — model: `gpt-4o-mini`
- **DB Tool**: `better-sqlite3` with a seeded mock dataset
- **Web Search Tool**: Tavily API (free tier) — `@tavily/core`
- **Code Runner Tool**: Node.js `vm` module (sandboxed)
- **Calculator Tool**: `mathjs`
- **Streaming**: Server-Sent Events (SSE)
- **Validation**: `zod`
- **Logging**: `pino`
- **Env**: dotenv + zod env validation at startup

---

## Project Structure

```
devagent/
├── src/
│   ├── server.ts              # Express app bootstrap
│   ├── routes/
│   │   └── agent.routes.ts    # All 4 API routes
│   ├── agent/
│   │   ├── agent.loop.ts      # Core agent loop logic
│   │   ├── tool.dispatcher.ts # Routes tool calls to implementations
│   │   └── tool.definitions.ts# OpenAI-compatible tool definitions (JSON schema)
│   ├── tools/
│   │   ├── web-search.tool.ts
│   │   ├── db-query.tool.ts
│   │   ├── calculator.tool.ts
│   │   └── code-runner.tool.ts
│   ├── db/
│   │   ├── client.ts          # SQLite connection singleton
│   │   └── seed.ts            # Seed script for mock data
│   ├── types/
│   │   ├── agent.types.ts     # AgentRun, ToolCall, ToolResult types
│   │   └── tool.types.ts      # Tool interface contract
│   ├── store/
│   │   └── run.store.ts       # In-memory run state store (Map)
│   ├── middleware/
│   │   ├── error.middleware.ts
│   │   └── validate.middleware.ts
│   └── config/
│       └── env.ts             # Zod env schema + validated export
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

---

## API Specification

### POST /api/agent/run

Start a new agent run.

**Request body:**

```json
{
  "prompt": "What is the latest Node.js version and how many days ago was it released?"
}
```

**Response:**

```json
{
  "runId": "uuid-v4",
  "status": "running"
}
```

---

### GET /api/agent/:runId/stream

SSE stream of the agent's execution.

**Events emitted (each is a JSON string in `data:` field):**

```
data: {"type":"tool_call","tool":"web_search","args":{"query":"latest Node.js version 2025"}}
data: {"type":"tool_result","tool":"web_search","result":"Node.js v22.14 released Jan 15 2025"}
data: {"type":"tool_call","tool":"calculator","args":{"expression":"dateDiff('2025-01-15', 'today')"}}
data: {"type":"tool_result","tool":"calculator","result":"146"}
data: {"type":"final_answer","content":"Node.js v22.14 is the latest LTS, released 146 days ago."}
data: {"type":"done"}
```

---

### GET /api/agent/:runId/status

Poll run status.

**Response:**

```json
{
  "runId": "uuid-v4",
  "status": "done",
  "finalAnswer": "Node.js v22.14 is the latest LTS, released 146 days ago.",
  "steps": [...]
}
```

---

### GET /api/tools/list

List all available tools with their descriptions.

**Response:**

```json
{
  "tools": [
    { "name": "web_search", "description": "Search the web for real-time information" },
    { "name": "db_query", "description": "Query the SQLite database in natural language" },
    { "name": "calculator", "description": "Evaluate mathematical expressions" },
    { "name": "code_runner", "description": "Execute JavaScript code snippets safely" }
  ]
}
```

---

## Core Agent Loop — MUST implement exactly like this

```typescript
// src/agent/agent.loop.ts
import OpenAI from "openai";
import { env } from "../config/env";
import { TOOL_DEFINITIONS } from "./tool.definitions";
import { dispatchTool } from "./tool.dispatcher";
import { AgentEvent } from "../types/agent.types";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function runAgentLoop(
  runId: string,
  prompt: string,
  emit: (event: AgentEvent) => void
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "user", content: prompt }
  ];

  const MAX_ITERATIONS = 10; // prevent infinite loops

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
    });

    const message = response.choices[0].message;
    messages.push(message); // always push assistant message back

    // No tool calls = final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      const finalAnswer = message.content ?? "No answer produced.";
      emit({ type: "final_answer", content: finalAnswer });
      return finalAnswer;
    }

    // Execute each tool call
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments);

      emit({ type: "tool_call", tool: toolCall.function.name, args });

      const result = await dispatchTool(toolCall.function.name, args);

      emit({ type: "tool_result", tool: toolCall.function.name, result });

      // Push tool result back to messages — OpenAI requires role: "tool"
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Agent exceeded max iterations — possible loop detected");
}
```

---

## Tool Interface Contract

Every tool MUST implement this interface — no exceptions:

```typescript
// src/types/tool.types.ts

export interface Tool {
  name: string;
  description: string;
  execute(args: Record<string, unknown>): Promise<unknown>;
}
```

---

## Tool: web-search

Use Tavily API.

```typescript
// src/tools/web-search.tool.ts
// args: { query: string }
// returns: { results: Array<{ title, url, content }> }
// Use TAVILY_API_KEY from env
// Limit to top 3 results
// Add 5 second timeout with AbortController
```

---

## Tool: db-query

SQLite with seeded mock data. Seed script must create:

- `users` table: id, name, email, created_at, plan (free/pro)
- `orders` table: id, user_id, amount, status, created_at

The tool receives natural language, converts to SQL using OpenAI (separate LLM call, no tools), executes on SQLite, returns rows.

```typescript
// src/tools/db-query.tool.ts
// args: { query: string } — natural language
// Step 1: call OpenAI with schema context to get SQL
// Step 2: execute SQL on SQLite
// Step 3: return { sql: string, rows: unknown[] }
// IMPORTANT: only allow SELECT statements — reject anything else
```

---

## Tool: calculator

```typescript
// src/tools/calculator.tool.ts
// Use mathjs: import { evaluate } from 'mathjs'
// args: { expression: string }
// returns: { result: number | string }
// Wrap in try/catch — invalid expressions should return { error: string }
```

---

## Tool: code-runner

```typescript
// src/tools/code-runner.tool.ts
// Use Node.js built-in 'vm' module
// args: { code: string }
// Run in vm.runInNewContext() with empty sandbox
// Hard timeout: 3000ms using vm timeout option
// Capture console.log output by overriding in sandbox
// returns: { output: string, error?: string }
// NEVER eval() — always vm.runInNewContext()
```

---

## Run Store (in-memory)

```typescript
// src/store/run.store.ts

export interface AgentRun {
  id: string;
  status: "running" | "done" | "failed";
  prompt: string;
  steps: AgentEvent[];
  finalAnswer?: string;
  error?: string;
  createdAt: Date;
}

// Use a Map<string, AgentRun> — no DB needed for this
```

---

## SSE Implementation

```typescript
// In agent.routes.ts GET /:runId/stream

res.setHeader("Content-Type", "text/event-stream");
res.setHeader("Cache-Control", "no-cache");
res.setHeader("Connection", "keep-alive");
res.flushHeaders();

const emit = (event: AgentEvent) => {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
};

// Handle client disconnect
req.on("close", () => {
  // cleanup if needed
});
```

---

## Environment Variables

```env
# .env.example
OPENAI_API_KEY=your_openai_key_here
TAVILY_API_KEY=your_tavily_key_here
PORT=3001
NODE_ENV=development
```

Zod env validation at startup:

```typescript
// src/config/env.ts
import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const EnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  TAVILY_API_KEY: z.string().min(1, "TAVILY_API_KEY is required"),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = EnvSchema.parse(process.env);
// If any key missing, this throws at startup — app never boots with bad config
```

Validate all env vars at startup using zod. If any are missing, crash immediately with a clear error message. Do not let the app start with missing config.

---

## Error Handling Rules

1. All async route handlers wrapped in `asyncHandler` utility
2. Tool failures must NOT crash the agent loop — catch and return `{ error: string }` as tool result
3. Global error middleware returns `{ error: string, code: string }` — never expose stack traces
4. Agent loop `MAX_ITERATIONS` exceeded → status = "failed", clear error message

---

## TypeScript Config

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

---

## Scripts in package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "seed": "tsx src/db/seed.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## What NOT to do

- Do NOT use LangChain, LlamaIndex, or any agent framework
- Do NOT use `any` type — use `unknown` and narrow it
- Do NOT put business logic in route handlers — routes call agent, agent calls tools
- Do NOT use `eval()` anywhere
- Do NOT swallow errors silently — always log with pino
- Do NOT store API keys in code — always from env

---

## Definition of Done

- [ ] All 4 endpoints working
- [ ] Agent loop handles multi-step tool calling correctly
- [ ] SSE stream emits events in real-time
- [ ] All 4 tools functional with real APIs
- [ ] TypeScript compiles with zero errors (`npm run typecheck`)
- [ ] README explains how to run + example prompts to test
- [ ] Seed script populates SQLite with realistic mock data

---

## Git Workflow — MANDATORY

After EVERY feature is completed, create a git commit immediately.
Do NOT batch multiple features into one commit.

Run `git init` once at the start, then commit after each milestone:

```bash
git init
git add . && git commit -m "chore: init project structure and tsconfig"

# After each feature:
git add . && git commit -m "feat: add Express server with health check"
git add . && git commit -m "feat: add agent loop with OpenAI tool calling"
git add . && git commit -m "feat: add web-search tool (Tavily)"
git add . && git commit -m "feat: add calculator tool (mathjs)"
git add . && git commit -m "feat: add code-runner tool (vm sandbox)"
git add . && git commit -m "feat: add db-query tool (SQLite + NL to SQL)"
git add . && git commit -m "feat: add SSE streaming endpoint"
git add . && git commit -m "feat: add run store and status endpoint"
git add . && git commit -m "chore: add .env.example and README"
```

Use conventional commits format: `feat:`, `fix:`, `chore:`, `refactor:`
