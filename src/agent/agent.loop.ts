import OpenAI from "openai";
import { env } from "../config/env";
import { TOOL_DEFINITIONS } from "./tool.definitions";
import { dispatchTool } from "./tool.dispatcher";
import { AgentEvent } from "../types/agent.types";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function runAgentLoop(
  runId: string,
  prompt: string,
  emit: (event: AgentEvent) => void
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];

  const MAX_ITERATIONS = 10; // prevent infinite loops

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
    });

    const message = response.choices[0].message;
    messages.push(message); // always push assistant message back

    // No tool calls = final answer
    if (!message.tool_calls || message.tool_calls.length === 0) {
      const finalAnswer = message.content ?? "No answer produced.";
      emit({ type: "final_answer", content: finalAnswer });
      return finalAnswer;
    }

    // Execute each tool call
    for (const toolCall of message.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

      emit({ type: "tool_call", tool: toolCall.function.name, args });

      const result = await dispatchTool(toolCall.function.name, args);

      emit({ type: "tool_result", tool: toolCall.function.name, result });

      // Push tool result back to messages — OpenAI requires role: "tool"
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }

  throw new Error("Agent exceeded max iterations — possible loop detected");
}
