import OpenAI from "openai";


export const TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information. Returns the top 3 results.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "db_query",
      description:
        "Query the SQLite database using natural language. The database has `users` and `orders` tables. Read-only.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "A natural language description of the data you want.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculator",
      description: "Evaluate a mathematical expression and return the result.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The math expression to evaluate, e.g. '2 + 2 * 10'.",
          },
        },
        required: ["expression"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "code_runner",
      description:
        "Execute a JavaScript code snippet in a sandbox and return its console output. Use console.log to produce output.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The JavaScript code to run.",
          },
        },
        required: ["code"],
        additionalProperties: false,
      },
    },
  },
];

export const TOOL_LIST = TOOL_DEFINITIONS.map((t) => ({
  name: t.function.name,
  description: t.function.description ?? "",
}));
