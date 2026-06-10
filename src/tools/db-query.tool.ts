// src/tools/db-query.tool.ts
import OpenAI from "openai";
import { z } from "zod";
import { Tool } from "../types/tool.types";
import { getDb } from "../db/client";
import { env } from "../config/env";
import { logger } from "../config/logger";

const ArgsSchema = z.object({
  query: z.string().min(1, "query is required"),
});

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const SCHEMA_CONTEXT = `
You convert natural language questions into a single SQLite SELECT query.

Schema:
  users(id INTEGER, name TEXT, email TEXT, created_at TEXT, plan TEXT CHECK plan IN ('free','pro'))
  orders(id INTEGER, user_id INTEGER, amount REAL, status TEXT CHECK status IN ('pending','paid','refunded','cancelled'), created_at TEXT)
  orders.user_id references users.id

Rules:
- Return ONLY the raw SQL, no markdown fences, no explanation.
- Generate exactly one statement.
- Use a SELECT statement only. Never write INSERT/UPDATE/DELETE/DROP/ALTER/etc.
- Dates are stored as ISO text (YYYY-MM-DD).
`.trim();

/**
 * Strips markdown fences and trailing semicolons, returns the trimmed SQL.
 */
function cleanSql(raw: string): string {
  return raw
    .replace(/```sql/gi, "")
    .replace(/```/g, "")
    .trim()
    .replace(/;+\s*$/, "")
    .trim();
}

/**
 * Guards against anything that is not a single read-only SELECT.
 */
function isSafeSelect(sql: string): boolean {
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith("select")) return false;
  // Reject multiple statements (a semicolon anywhere but the very end).
  if (sql.replace(/;+\s*$/, "").includes(";")) return false;
  // Reject mutating / DDL keywords defensively.
  const forbidden = /\b(insert|update|delete|drop|alter|create|replace|attach|pragma|truncate)\b/i;
  if (forbidden.test(sql)) return false;
  return true;
}

export const dbQueryTool: Tool = {
  name: "db_query",
  description: "Query the SQLite database in natural language",

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const parsed = ArgsSchema.safeParse(args);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid arguments" };
    }

    try {
      // Step 1: NL -> SQL via a separate, tool-less LLM call.
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: SCHEMA_CONTEXT },
          { role: "user", content: parsed.data.query },
        ],
      });

      const rawSql = completion.choices[0]?.message.content ?? "";
      const sql = cleanSql(rawSql);

      // IMPORTANT: only allow SELECT statements — reject anything else.
      if (!isSafeSelect(sql)) {
        return { error: "Only read-only SELECT queries are allowed.", sql };
      }

      // Step 2: execute on SQLite.
      const db = getDb();
      const rows = db.prepare(sql).all();

      // Step 3: return SQL + rows.
      return { sql, rows };
    } catch (err) {
      const message = err instanceof Error ? err.message : "db_query failed";
      logger.error({ err }, "db_query tool failed");
      return { error: message };
    }
  },
};
