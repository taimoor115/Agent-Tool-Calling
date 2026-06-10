// src/routes/agent.routes.ts
import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { asyncHandler, AppError } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { createRun, getRun } from "../store/run.store";
import { startRun, subscribe } from "../agent/agent.runner";
import { TOOL_LIST } from "../agent/tool.definitions";
import { AgentEvent } from "../types/agent.types";

export const agentRouter = Router();

const RunBodySchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
});

/**
 * POST /api/agent/run — start a new agent run.
 */
agentRouter.post(
  "/agent/run",
  validateBody(RunBodySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body as z.infer<typeof RunBodySchema>;
    const runId = uuidv4();

    createRun(runId, prompt);
    startRun(runId, prompt);

    res.status(202).json({ runId, status: "running" });
  })
);

/**
 * GET /api/agent/:runId/stream — SSE stream of the agent's execution.
 */
agentRouter.get(
  "/agent/:runId/stream",
  asyncHandler(async (req: Request, res: Response) => {
    const { runId } = req.params;
    const run = getRun(runId);
    if (!run) {
      throw new AppError(404, `Run not found: ${runId}`, "RUN_NOT_FOUND");
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const emit = (event: AgentEvent): void => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Replay any events that already happened before this client connected.
    const alreadyDone = run.status !== "running";
    for (const step of run.steps) {
      emit(step);
    }

    // If the run already finished, close immediately after replay.
    if (alreadyDone) {
      // Ensure a terminal `done` was sent even if status flipped mid-replay.
      const lastWasDone = run.steps[run.steps.length - 1]?.type === "done";
      if (!lastWasDone) emit({ type: "done" });
      res.end();
      return;
    }

    // Subscribe to live events.
    const unsubscribe = subscribe(runId, (event) => {
      emit(event);
      if (event.type === "done") {
        unsubscribe();
        res.end();
      }
    });

    // Handle client disconnect — cleanup the subscription.
    req.on("close", () => {
      unsubscribe();
    });
  })
);

/**
 * GET /api/agent/:runId/status — poll run status.
 */
agentRouter.get(
  "/agent/:runId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const { runId } = req.params;
    const run = getRun(runId);
    if (!run) {
      throw new AppError(404, `Run not found: ${runId}`, "RUN_NOT_FOUND");
    }

    res.json({
      runId: run.id,
      status: run.status,
      finalAnswer: run.finalAnswer,
      error: run.error,
      steps: run.steps,
    });
  })
);

/**
 * GET /api/tools/list — list all available tools with descriptions.
 */
agentRouter.get(
  "/tools/list",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ tools: TOOL_LIST });
  })
);
