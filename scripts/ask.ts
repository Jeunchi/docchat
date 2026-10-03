import "./_env";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { retrieve } from "../src/lib/retrieve";
import { SYSTEM_PROMPT, buildContext, normalizeCitations, type Source } from "../src/lib/rag";
import { scriptUserId } from "./_user";
import { sql } from "../src/lib/db";

const MIN_SCORE = -1;

async function main() {
  const args = process.argv.slice(2);
  const docArg = args.find((a) => a.startsWith("--doc="));
  const docId = docArg?.slice("--doc=".length);
  const debug = args.includes("--debug");
  const question = args.filter((a) => !a.startsWith("--")).join(" ");

  if (!question) {
    throw new Error('Usage: npx tsx scripts/ask.ts [--doc=<id>] [--debug] "your question"');
  }

  const userId = await scriptUserId();
  const sources = (await retrieve(userId, question, 8, docId)) as unknown as Source[];

  if (debug) {
    console.log("\n--- CONTEXT SENT TO MODEL ---\n" + buildContext(sources) + "\n-----------------------------");
  }

  if (sources.length === 0 || Number(sources[0].score) < MIN_SCORE) {
    console.log("\nI couldn't find that in the uploaded documents. (no LLM call made)\n");
    await sql.end();
    return;
  }

  const { text } = await generateText({
    model: groq(process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"),
    system: SYSTEM_PROMPT,
    prompt: `Sources:\n${buildContext(sources)}\n\nQuestion: ${question}`,
  });

  console.log("\n" + normalizeCitations(text) + "\n");
  console.log("Sources:");
  sources.forEach((s, i) =>
    console.log(`[${i + 1}] ${s.filename} p.${s.page_number} (score ${Number(s.score).toFixed(3)})`)
  );

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});