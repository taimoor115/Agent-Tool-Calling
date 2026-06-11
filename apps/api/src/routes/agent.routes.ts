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

    let closed = false;
    const emit = (event: AgentEvent): void => {
      if (!closed) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // `run.steps` is the authoritative ordered log — every emitted event is
    // appended there before the bus fires. We drive all output from it and use
    // the bus purely as a "something changed" trigger. `sentCount` tracks how
    // many steps we've already written, so flushing is idempotent and free of
    // both the replay/subscribe race AND duplicate events.
    let sentCount = 0;
    let unsubscribe = (): void => {};

    const flush = (): void => {
      while (sentCount < run.steps.length) {
        const event = run.steps[sentCount];
        sentCount += 1;
        emit(event);
        if (event.type === "done") {
          unsubscribe();
          closed = true;
          res.end();
          return;
        }
      }
    };

    // Subscribe first, then flush — so any event landing during setup is caught
    // by the post-subscribe flush, which always reads the latest steps.
    unsubscribe = subscribe(runId, flush);
    flush();

    // Handle client disconnect — cleanup the subscription.
    req.on("close", () => {
      closed = true;
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
