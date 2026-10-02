import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { groq } from "@ai-sdk/groq";
import { retrieve } from "@/lib/retrieve";
import { standaloneQuestion } from "@/lib/condense";
import { SYSTEM_PROMPT, buildContext, type Source } from "@/lib/rag";
import type { ChatMessage, SourceInfo } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MIN_SCORE = -1; // cosine similarity is never below -1, so the gate never blocks a search
const NOT_FOUND = "I couldn't find that in the uploaded documents.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const { messages, documentId } = (await req.json()) as {
    messages: ChatMessage[];
    documentId?: string;
  };

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  let question = "";
  for (const p of lastUser?.parts ?? []) {
    if (p.type === "text") question += p.text;
  }
  question = question.trim();

  if (!question) {
    return Response.json({ error: "Empty question." }, { status: 400 });
  }
  if (question.length > 1000) {
    return Response.json({ error: "Question too long (1000 characters max)." }, { status: 400 });
  }
  if (documentId && !UUID.test(documentId)) {
    return Response.json({ error: "Invalid document." }, { status: 400 });
  }

  // Resolve "it", "those", "the second one" etc. using the chat history.
  const searchQuery = await standaloneQuestion(messages);
  if (process.env.NODE_ENV !== "production") {
    console.log("[chat] search query:", searchQuery);
  }

  let rows: Source[];
  try {
    rows = (await retrieve(searchQuery, 8, documentId || undefined)) as unknown as Source[];
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Search failed." }, { status: 500 });
  }
    if (process.env.NODE_ENV !== "production") {
    console.log("[chat] top score:", rows[0] ? Number(rows[0].score).toFixed(3) : "none");
  }

  const sources: SourceInfo[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    page: r.page_number,
    pageEnd: r.page_end ?? r.page_number,
    score: Number(r.score),
    content: r.content,
  }));
  const relevant = rows.length > 0 && Number(rows[0].score) >= MIN_SCORE;

  const stream = createUIMessageStream<ChatMessage>({
    execute: ({ writer }) => {
      if (!relevant) {
        writer.write({ type: "text-start", id: "not-found" });
        writer.write({ type: "text-delta", id: "not-found", delta: NOT_FOUND });
        writer.write({ type: "text-end", id: "not-found" });
        return;
      }

      writer.write({ type: "data-sources", data: sources });

      const result = streamText({
        model: groq(process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"),
        system: SYSTEM_PROMPT,
        prompt: `Sources:\n${buildContext(rows)}\n\nQuestion: ${searchQuery}`,
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: () => "Something went wrong while generating the answer.",
  });

  return createUIMessageStreamResponse({ stream });
}