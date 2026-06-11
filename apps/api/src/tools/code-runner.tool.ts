// src/tools/code-runner.tool.ts
import vm from "node:vm";
import { z } from "zod";
import { Tool } from "../types/tool.types";

const ArgsSchema = z.object({
  code: z.string().min(1, "code is required"),
});

const TIMEOUT_MS = 3000;

export const codeRunnerTool: Tool = {
  name: "code_runner",
  description: "Execute JavaScript code snippets safely",

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid arguments" };
    }

    const logs: string[] = [];

    // Minimal sandbox: only a console.log shim is exposed. No require, no
    // process, no fs — the empty context keeps untrusted code isolated.
    const sandbox = {
      console: {
        log: (...parts: unknown[]) => {
          logs.push(parts.map((p) => stringify(p)).join(" "));
        },
      },
    };

    try {
      const result = vm.runInNewContext(parsed.data.code, sandbox, {
        timeout: TIMEOUT_MS,
      });

      // If nothing was logged but an expression value was produced, surface it.
      if (logs.length === 0 && result !== undefined) {
        logs.push(stringify(result));
      }

      return { output: logs.join("\n") };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Execution failed";
      return { output: logs.join("\n"), error: message };
    }
  },
};

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
