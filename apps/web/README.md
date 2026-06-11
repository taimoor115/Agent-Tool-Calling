# @devagent/web

The **Next.js 16 + React 19** web UI for [DevAgent](../../README.md) — a live
console for the agent API.

## What it does

- Starts an agent run (`POST /api/agent/run`) from a prompt box.
- Opens an `EventSource` to the SSE `/stream` endpoint and renders each
  `tool_call` / `tool_result` / `final_answer` live, colour-coded per tool.
- Lists the agent's tools from `GET /api/tools/list`.

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4

## Run

From the **repo root** (recommended — starts the API too):

```bash
npm run dev          # both apps
# or
npm run dev:web      # this app only
```

Standalone, from this folder:

```bash
npm run dev          # http://localhost:3000
npm run build && npm start
```

## Configuration

Point the UI at your API via `apps/web/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

This must be reachable from the **browser**, and the API must allow this origin
via its `CORS_ORIGIN` setting.

## Key files

| Path | Role |
| ---- | ---- |
| `app/page.tsx` | Composes the console layout |
| `hooks/useAgentRun.ts` | Starts a run + consumes the SSE stream |
| `lib/api.ts` · `lib/types.ts` | API client + shared event types |
| `components/` | `PromptForm`, `ToolsList`, `EventStream`, `EventCard` |
