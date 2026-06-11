// src/agent/agent.runner.ts
import { EventEmitter } from "node:events";
import { runAgentLoop } from "./agent.loop";
import { AgentEvent } from "../types/agent.types";
import {
  appendStep,
  setError,
  setFinalAnswer,
  setStatus,
} from "../store/run.store";
import { logger } from "../config/logger";

/**
 * Per-run event bus. The agent loop publishes events here; SSE subscribers
 * listen. Each run gets its own emitter so streams stay isolated.
 */
const buses = new Map<string, EventEmitter>();

function getBus(runId: string): EventEmitter {
  let bus = buses.get(runId);
  if (!bus) {
    bus = new EventEmitter();
    bus.setMaxListeners(0); // allow many concurrent SSE clients
    buses.set(runId, bus);
  }
  return bus;
}

/** Subscribe to live events for a run. Returns an unsubscribe function. */
export function subscribe(runId: string, listener: (event: AgentEvent) => void): () => void {
  const bus = getBus(runId);
  bus.on("event", listener);
  return () => bus.off("event", listener);
}

/**
 * Kick off the agent loop in the background (fire-and-forget). Records every
 * event into the run store and broadcasts it to live subscribers, then emits
 * a terminal `done` event.
 */
export function startRun(runId: string, prompt: string): void {
  const bus = getBus(runId);

  const emit = (event: AgentEvent): void => {
    appendStep(runId, event);
    bus.emit("event", event);
  };

  // Fire-and-forget — POST /run returns immediately while this executes.
  void (async () => {
    try {
      const finalAnswer = await runAgentLoop(runId, prompt, emit);
      setFinalAnswer(runId, finalAnswer);
      setStatus(runId, "done");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Agent run failed";
      logger.error({ err, runId }, "Agent run failed");
      setStatus(runId, "failed");
      setError(runId, message);
      emit({ type: "error", message });
    } finally {
      // Terminal event so SSE clients know to close.
      const doneEvent: AgentEvent = { type: "done" };
      appendStep(runId, doneEvent);
      bus.emit("event", doneEvent);
      bus.emit("close");
    }
  })();
}
