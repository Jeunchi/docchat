import "./_env";
import { readFileSync } from "fs";
import path from "path";
import { ingestPdf } from "../src/lib/ingest";
import { sql } from "../src/lib/db";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npx tsx scripts/ingest.ts <path-to-pdf>");
  const result = await ingestPdf(new Uint8Array(readFileSync(file)), path.basename(file));
  console.log(result);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});