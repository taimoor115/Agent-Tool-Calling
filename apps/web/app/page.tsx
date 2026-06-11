// apps/web/app/page.tsx
"use client";

import { useAgentRun } from "@/hooks/useAgentRun";
import { PromptForm } from "@/components/PromptForm";
import { ToolsList } from "@/components/ToolsList";
import { EventStream } from "@/components/EventStream";
import { API_URL } from "@/lib/api";

export default function Home() {
  const agent = useAgentRun();

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              DevAgent
            </h1>
            <p className="text-sm text-zinc-500">
              An AI agent that reasons and calls tools — live, in your browser.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* Left column: input + tools */}
        <div className="space-y-5">
          <PromptForm onSubmit={agent.run} isRunning={agent.isRunning} />
          <ToolsList />

          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-500">
            <span>API</span>
            <code className="text-zinc-400">{API_URL}</code>
          </div>

          {agent.status !== "idle" && (
            <button
              onClick={agent.reset}
              className="w-full rounded-lg border border-zinc-700 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right column: live stream — min-w-0 prevents the 1fr column from
            expanding past the viewport when tool results contain long text */}
        <div className="min-w-0 min-h-[28rem] lg:h-[calc(100vh-10rem)] lg:min-h-0">
          <EventStream
            events={agent.events}
            status={agent.status}
            error={agent.error}
          />
        </div>
      </div>

      <footer className="mt-10 text-center text-xs text-zinc-600">
        Express + node:sqlite API · Next.js 16 · React 19 · streamed over SSE
      </footer>
    </main>
  );
}
