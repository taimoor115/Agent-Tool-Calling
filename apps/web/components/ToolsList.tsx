// apps/web/components/ToolsList.tsx
"use client";

import { useEffect, useState } from "react";
import { listTools } from "@/lib/api";
import type { ToolInfo } from "@/lib/types";

const ICONS: Record<string, string> = {
  web_search: "🌐",
  db_query: "🗄️",
  calculator: "🧮",
  code_runner: "⚙️",
};

export function ToolsList() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTools()
      .then(setTools)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Could not load tools")
      );
  }, []);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Available Tools
      </h2>
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : tools.length === 0 ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {tools.map((t) => (
            <li key={t.name} className="flex gap-2.5">
              <span className="text-lg leading-none">{ICONS[t.name] ?? "🔧"}</span>
              <div>
                <p className="text-sm font-medium text-zinc-200">{t.name}</p>
                <p className="text-xs leading-snug text-zinc-500">{t.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
