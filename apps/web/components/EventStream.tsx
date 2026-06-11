// apps/web/components/EventStream.tsx
"use client";

import { useEffect, useRef } from "react";
import type { AgentEvent, RunStatus } from "@/lib/types";
import { EventCard } from "./EventCard";

const STATUS_STYLES: Record<RunStatus | "idle", string> = {
  idle: "bg-zinc-700 text-zinc-300",
  running: "bg-amber-500/20 text-amber-300",
  done: "bg-emerald-500/20 text-emerald-300",
  failed: "bg-rose-500/20 text-rose-300",
};

export function EventStream({
  events,
  status,
  error,
}: {
  events: AgentEvent[];
  status: RunStatus | "idle";
  error: string | null;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the newest event.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Agent Activity
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLES[status]}`}
        >
          {status === "running" && (
            <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current align-middle" />
          )}
          {status}
        </span>
      </div>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4">
        {events.length === 0 && status === "idle" && (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-sm text-zinc-600">
            <span className="mb-2 text-3xl">🤖</span>
            <p>Ask a question to watch the agent think and call tools live.</p>
          </div>
        )}

        {events.length === 0 && status === "running" && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
            Thinking…
          </div>
        )}

        {events.map((event, i) => (
          <EventCard key={i} event={event} />
        ))}

        {error && status === "failed" && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            ⚠️ {error}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
