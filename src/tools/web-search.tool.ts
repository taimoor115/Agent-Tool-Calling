// src/tools/web-search.tool.ts
import { tavily } from "@tavily/core";
import { z } from "zod";
import { Tool } from "../types/tool.types";
import { env } from "../config/env";

const ArgsSchema = z.object({
  query: z.string().min(1, "query is required"),
});

const TIMEOUT_MS = 5000;
const MAX_RESULTS = 3;

const client = tavily({ apiKey: env.TAVILY_API_KEY });

export const webSearchTool: Tool = {
  name: "web_search",
  description: "Search the web for real-time information",

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid arguments" };
    }

    // 5 second timeout via AbortController.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await client.search(parsed.data.query, {
        maxResults: MAX_RESULTS,
        signal: controller.signal,
      });

      const results = (response.results ?? []).slice(0, MAX_RESULTS).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      }));

      return { results };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { error: `web_search timed out after ${TIMEOUT_MS}ms` };
      }
      const message = err instanceof Error ? err.message : "web_search failed";
      return { error: message };
    } finally {
      clearTimeout(timer);
    }
  },
};
