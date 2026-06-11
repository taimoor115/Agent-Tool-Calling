// apps/web/components/PromptForm.tsx
"use client";

import { useState } from "react";

const EXAMPLES = [
  "How many pro-plan users are there, and what did they spend on paid orders? Verify the sum with the calculator.",
  "Write and run JS to return the first 10 Fibonacci numbers.",
  "What is the latest LTS version of Node.js?",
  "What is 1234 * 5678 divided by 3, rounded?",
];

export function PromptForm({
  onSubmit,
  isRunning,
}: {
  onSubmit: (prompt: string) => void;
  isRunning: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isRunning) return;
    onSubmit(trimmed);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Ask the agent
      </label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={3}
        placeholder="e.g. How many pro users do we have and what did they spend?"
        className="w-full resize-y rounded-lg border border-zinc-700 bg-black/30 p-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-violet-500/60"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-zinc-600">⌘/Ctrl + Enter to run</span>
        <button
          onClick={submit}
          disabled={isRunning || value.trim().length === 0}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRunning ? "Running…" : "Run agent"}
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
          Try an example
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setValue(ex)}
              disabled={isRunning}
              className="rounded-full border border-zinc-700 bg-zinc-800/40 px-3 py-1 text-left text-[11px] text-zinc-400 transition hover:border-violet-500/50 hover:text-zinc-200 disabled:opacity-40"
            >
              {ex.length > 48 ? `${ex.slice(0, 48)}…` : ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
