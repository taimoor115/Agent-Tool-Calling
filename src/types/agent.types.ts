// src/types/agent.types.ts

export type AgentEvent =
  | { type: "tool_call"; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: unknown }
  | { type: "final_answer"; content: string }
  | { type: "error"; message: string }
  | { type: "done" };

export type RunStatus = "running" | "done" | "failed";

export interface AgentRun {
  id: string;
  status: RunStatus;
  prompt: string;
  steps: AgentEvent[];
  finalAnswer?: string;
  error?: string;
  createdAt: Date;
}
