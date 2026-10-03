import "./_env";
import { retrieve } from "../src/lib/retrieve";
import { scriptUserId } from "./_user";
import { sql } from "../src/lib/db";

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) throw new Error('Usage: npx tsx scripts/search.ts "your question"');
  const userId = await scriptUserId();
  const rows = await retrieve(userId, question);
  for (const r of rows) {
    console.log(`\n[${Number(r.score).toFixed(3)}] ${r.filename} p.${r.page_number}`);
    console.log(String(r.content).slice(0, 200) + "...");
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});