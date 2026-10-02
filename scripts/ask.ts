import "./_env";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { retrieve } from "../src/lib/retrieve";
import { SYSTEM_PROMPT, buildContext, type Source } from "../src/lib/rag";
import { sql } from "../src/lib/db";

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) throw new Error('Usage: npx tsx scripts/ask.ts "your question"');

  const sources = (await retrieve(question, 5)) as unknown as Source[];

  const { text } = await generateText({
    model: groq(process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"),
    system: SYSTEM_PROMPT,
    prompt: `Sources:\n${buildContext(sources)}\n\nQuestion: ${question}`,
  });

  console.log("\n" + text + "\n");
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