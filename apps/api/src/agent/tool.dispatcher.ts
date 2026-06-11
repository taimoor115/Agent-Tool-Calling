// src/agent/tool.dispatcher.ts
import { Tool } from "../types/tool.types";
import { webSearchTool } from "../tools/web-search.tool";
import { dbQueryTool } from "../tools/db-query.tool";
import { calculatorTool } from "../tools/calculator.tool";
import { codeRunnerTool } from "../tools/code-runner.tool";
import { logger } from "../config/logger";

const REGISTRY: Record<string, Tool> = {
  [webSearchTool.name]: webSearchTool,
  [dbQueryTool.name]: dbQueryTool,
  [calculatorTool.name]: calculatorTool,
  [codeRunnerTool.name]: codeRunnerTool,
};


export async function dispatchTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const tool = REGISTRY[name];
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }

  try {
    return await tool.execute(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    logger.error({ err, tool: name }, "Tool execution threw");
    return { error: message };
  }
}
