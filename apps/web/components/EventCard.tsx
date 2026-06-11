// apps/web/components/EventCard.tsx
import type { AgentEvent } from "@/lib/types";

const TOOL_META: Record<string, { icon: string; label: string }> = {
  web_search: { icon: "🌐", label: "Web Search" },
  db_query: { icon: "🗄️", label: "Database" },
  calculator: { icon: "🧮", label: "Calculator" },
  code_runner: { icon: "⚙️", label: "Code Runner" },
};

function pretty(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function EventCard({ event }: { event: AgentEvent }) {
  if (event.type === "tool_call") {
    const meta = TOOL_META[event.tool] ?? { icon: "🔧", label: event.tool };
    return (
      <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-sky-300">
          <span>{meta.icon}</span>
          <span>Calling {meta.label}</span>
          <code className="ml-auto rounded bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-200">
            {event.tool}
          </code>
        </div>
        <pre className="scrollbar-thin mt-2 max-w-full overflow-x-auto rounded bg-black/30 p-2 text-xs text-zinc-300">
          {pretty(event.args)}
        </pre>
      </div>
    );
  }

  if (event.type === "tool_result") {
    const meta = TOOL_META[event.tool] ?? { icon: "🔧", label: event.tool };
    const isError =
      typeof event.result === "object" &&
      event.result !== null &&
      "error" in (event.result as Record<string, unknown>);
    return (
      <div
        className={`rounded-lg border p-3 ${
          isError
            ? "border-rose-500/30 bg-rose-500/5"
            : "border-emerald-500/20 bg-emerald-500/5"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-sm font-medium ${
            isError ? "text-rose-300" : "text-emerald-300"
          }`}
        >
          <span>{isError ? "⚠️" : "✓"}</span>
          <span>
            {meta.label} {isError ? "error" : "result"}
          </span>
        </div>
        <pre className="scrollbar-thin mt-2 max-h-60 max-w-full overflow-auto rounded bg-black/30 p-2 text-xs text-zinc-300">
          {pretty(event.result)}
        </pre>
      </div>
    );
  }

  if (event.type === "final_answer") {
    return (
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-violet-200">
          <span>✨</span>
          <span>Final Answer</span>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-100">
          {event.content}
        </p>
      </div>
    );
  }

  if (event.type === "error") {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
        ⚠️ {event.message}
      </div>
    );
  }

  // done
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span className="h-px flex-1 bg-zinc-800" />
      <span>run complete</span>
      <span className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}
