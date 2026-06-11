// src/tools/calculator.tool.ts
import { evaluate } from "mathjs";
import { z } from "zod";
import { Tool } from "../types/tool.types";

const ArgsSchema = z.object({
  expression: z.string().min(1, "expression is required"),
});

export const calculatorTool: Tool = {
  name: "calculator",
  description: "Evaluate mathematical expressions",

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid arguments" };
    }

    try {
      const result = evaluate(parsed.data.expression);

      // mathjs can return numbers, strings, matrices, units, etc.
      // Normalise to a number | string for the agent.
      if (typeof result === "number" || typeof result === "string") {
        return { result };
      }
      return { result: String(result) };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid expression";
      return { error: message };
    }
  },
};
