// apps/web/lib/types.ts
// Mirrors the event/run shapes emitted by the @devagent/api backend.

export type AgentEvent =
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "final_answer"; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type RunStatus = "running" | "done" | "failed";

export interface ToolInfo {
  name: string;
  description: string;
}

export interface RunStatusResponse {
  runId: string;
  status: RunStatus;
  finalAnswer?: string;
  error?: string;
  steps: AgentEvent[];
}

export interface StartRunResponse {
  runId: string;
  status: RunStatus;
}
