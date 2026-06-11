// apps/web/hooks/useAgentRun.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startRun, streamUrl } from "@/lib/api";
import type { AgentEvent, RunStatus } from "@/lib/types";

export interface UseAgentRun {
  runId: string | null;
  status: RunStatus | "idle";
  events: AgentEvent[];
  finalAnswer: string | null;
  error: string | null;
  isRunning: boolean;
  run: (prompt: string) => Promise<void>;
  reset: () => void;
}

/**
 * Manages a single agent run: kicks it off via POST /run, then consumes the
 * SSE stream with EventSource, appending each event as it arrives.
 */
export function useAgentRun(): UseAgentRun {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatus | "idle">("idle");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  const reset = useCallback(() => {
    closeStream();
    setRunId(null);
    setStatus("idle");
    setEvents([]);
    setFinalAnswer(null);
    setError(null);
  }, [closeStream]);

  const run = useCallback(
    async (prompt: string) => {
      closeStream();
      setEvents([]);
      setFinalAnswer(null);
      setError(null);
      setStatus("running");

      let id: string;
      try {
        const res = await startRun(prompt);
        id = res.runId;
        setRunId(id);
      } catch (err) {
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Failed to start run");
        return;
      }

      const source = new EventSource(streamUrl(id));
      sourceRef.current = source;

      source.onmessage = (e: MessageEvent<string>) => {
        let event: AgentEvent;
        try {
          event = JSON.parse(e.data) as AgentEvent;
        } catch {
          return;
        }

        setEvents((prev) => [...prev, event]);

        if (event.type === "final_answer") {
          setFinalAnswer(event.content);
        } else if (event.type === "error") {
          setError(event.message);
          setStatus("failed");
        } else if (event.type === "done") {
          setStatus((s) => (s === "failed" ? "failed" : "done"));
          closeStream();
        }
      };

      source.onerror = () => {
        // The stream closes itself after `done`; only surface an error if we
        // were still mid-run when the connection dropped.
        setStatus((s) => {
          if (s === "running") {
            setError("Stream connection lost. Is the API running?");
            closeStream();
            return "failed";
          }
          return s;
        });
      };
    },
    [closeStream]
  );

  // Clean up the EventSource if the component unmounts mid-stream.
  useEffect(() => closeStream, [closeStream]);

  return {
    runId,
    status,
    events,
    finalAnswer,
    error,
    isRunning: status === "running",
    run,
    reset,
  };
}
