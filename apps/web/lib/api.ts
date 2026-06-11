// apps/web/lib/api.ts
import type { StartRunResponse, ToolInfo, RunStatusResponse } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Start a new agent run. Returns the runId to stream/poll. */
export async function startRun(prompt: string): Promise<StartRunResponse> {
  const res = await fetch(`${API_URL}/api/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to start run (${res.status})`);
  }
  return res.json() as Promise<StartRunResponse>;
}

/** List the tools the agent can use. */
export async function listTools(): Promise<ToolInfo[]> {
  const res = await fetch(`${API_URL}/api/tools/list`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load tools (${res.status})`);
  const body = (await res.json()) as { tools: ToolInfo[] };
  return body.tools;
}

/** Poll a run's current status + full step history. */
export async function getStatus(runId: string): Promise<RunStatusResponse> {
  const res = await fetch(`${API_URL}/api/agent/${runId}/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load status (${res.status})`);
  return res.json() as Promise<RunStatusResponse>;
}

/** SSE stream URL for a run (consume with EventSource). */
export function streamUrl(runId: string): string {
  return `${API_URL}/api/agent/${runId}/stream`;
}
