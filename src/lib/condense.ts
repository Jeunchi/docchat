import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import type { ChatMessage } from "./types";

const CONDENSE_MODEL = process.env.GROQ_CONDENSE_MODEL ?? "openai/gpt-oss-20b";

const CONDENSE_PROMPT = `Rewrite the user's latest message as a standalone question that can be understood without the conversation.
Use the conversation to resolve references like "it", "that", "those", or "the second one".
If the message is already standalone, return it unchanged.
Output only the question, with no quotes and no explanation.`;

function textOf(m: ChatMessage) {
  let t = "";
  for (const p of m.parts) if (p.type === "text") t += p.text;
  return t.trim();
}

// Turns a follow-up into a standalone question for retrieval.
// Falls back to the original message if anything goes wrong.
export async function standaloneQuestion(messages: ChatMessage[]): Promise<string> {
  const turns = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, text: textOf(m) }))
    .filter((t) => t.text);

  const latest = turns[turns.length - 1];
  if (!latest || latest.role !== "user") return latest?.text ?? "";

  const history = turns.slice(0, -1).slice(-6);
  if (history.length === 0) return latest.text; // first question: nothing to resolve

  const transcript = history
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.text.slice(0, 600)}`)
    .join("\n");

  try {
    const { text } = await generateText({
      model: groq(CONDENSE_MODEL),
      system: CONDENSE_PROMPT,
      prompt: `Conversation so far:\n${transcript}\n\nLatest user message: ${latest.text}\n\nStandalone question:`,
      abortSignal: AbortSignal.timeout(8000),
    });
    const out = text.trim().replace(/^["']|["']$/g, "");
    return out && out.length <= 500 ? out : latest.text;
  } catch (err) {
    console.error("condense failed, using original question", err);
    return latest.text;
  }
}