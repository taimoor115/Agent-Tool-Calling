// src/store/run.store.ts
import { AgentRun, AgentEvent, RunStatus } from "../types/agent.types";

/**
 * In-memory run state store. A simple Map keyed by runId — no DB needed for
 * this project. Holds the full event history per run so late SSE subscribers
 * and the status endpoint can replay what already happened.
 */
const runs = new Map<string, AgentRun>();

export function createRun(id: string, prompt: string): AgentRun {
  const run: AgentRun = {
    id,
    status: "running",
    prompt,
    steps: [],
    createdAt: new Date(),
  };
  runs.set(id, run);
  return run;
}

export function getRun(id: string): AgentRun | undefined {
  return runs.get(id);
}

export function appendStep(id: string, event: AgentEvent): void {
  const run = runs.get(id);
  if (run) run.steps.push(event);
}

export function setStatus(id: string, status: RunStatus): void {
  const run = runs.get(id);
  if (run) run.status = status;
}

export function setFinalAnswer(id: string, finalAnswer: string): void {
  const run = runs.get(id);
  if (run) run.finalAnswer = finalAnswer;
}

export function setError(id: string, error: string): void {
  const run = runs.get(id);
  if (run) run.error = error;
}
