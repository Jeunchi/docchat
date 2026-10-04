import "./_env";
import { readFileSync, writeFileSync } from "fs";
import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { sql } from "../src/lib/db";
import { retrieve } from "../src/lib/retrieve";
import { scriptUserId } from "./_user";
import {
  SYSTEM_PROMPT,
  buildContext,
  normalizeCitations,
  type Source,
} from "../src/lib/rag";

type Case = {
  doc?: string; // part of the filename
  q: string;
  evidence?: string; // phrase that must appear in a retrieved chunk
  expect?: string[]; // phrases the answer must contain ("a|b" = either)
  unanswerable?: boolean; // correct behavior is "couldn't find"
};

type Result = {
  q: string;
  unanswerable: boolean;
  hasEvidence: boolean;
  evidenceMissing: boolean; // phrase isn't in the document at all (fix the question file)
  rank: number | null; // position of the first chunk containing the evidence
  answerOk: boolean | null;
  answer: string;
};

const K = 8;
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const retrievalOnly = process.argv.includes("--retrieval-only");

// Compare text ignoring case, whitespace, and fancy quotes/dashes.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, "");

const has = (normalizedHaystack: string, spec: string) =>
  spec.split("|").some((alt) => normalizedHaystack.includes(norm(alt)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type DocInfo = { id: string; filename: string; text: string };
const docCache = new Map<string, DocInfo | null>();

async function findDoc(userId: string, key: string): Promise<DocInfo | null> {
  if (docCache.has(key)) return docCache.get(key) ?? null;

  const [row] = await sql`
    select id, filename from documents
    where filename ilike ${"%" + key + "%"} and status = 'ready' and user_id = ${userId}
    order by created_at desc limit 1
  `;

  let info: DocInfo | null = null;
  if (row) {
    const [t] = await sql`
      select string_agg(content, ' ' order by chunk_index) as text
      from chunks where document_id = ${row.id}
    `;
    info = { id: row.id, filename: row.filename, text: norm(String(t?.text ?? "")) };
  }
  docCache.set(key, info);
  return info;
}

async function generate(question: string, sources: Source[]) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { text } = await generateText({
        model: groq(MODEL),
        system: SYSTEM_PROMPT,
        prompt: `Sources:\n${buildContext(sources)}\n\nQuestion: ${question}`,
      });
      return normalizeCitations(text);
    } catch (err) {
      lastError = err;
      await sleep(5000 * (attempt + 1)); // back off on rate limits
    }
  }
  throw lastError;
}

const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");

async function main() {
  const userId = await scriptUserId();
  const cases: Case[] = JSON.parse(readFileSync("eval/questions.json", "utf8"));
  const results: Result[] = [];
  let skipped = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const n = String(i + 1).padStart(2);

    let docId: string | undefined;
    let docText: string | undefined;
    if (c.doc) {
      const d = await findDoc(userId, c.doc);
      if (!d) {
        console.log(`${n}. SKIP (no ready document matching "${c.doc}"): ${c.q}`);
        skipped++;
        continue;
      }
      docId = d.id;
      docText = d.text;
    }

    const sources = (await retrieve(userId, c.q, K, docId)) as unknown as Source[];
    const retrieved = sources.map((s) => norm(s.content));

    let rank: number | null = null;
    let evidenceMissing = false;
    if (c.evidence) {
      const idx = retrieved.findIndex((t) => has(t, c.evidence!));
      rank = idx >= 0 ? idx + 1 : null;
      if (rank === null && docText && !has(docText, c.evidence)) evidenceMissing = true;
    }

    let answer = "";
    let answerOk: boolean | null = null;
    if (!retrievalOnly) {
      answer = await generate(c.q, sources);
      const a = norm(answer.replace(/\[\d+\]/g, ""));
      const refused = a.includes(norm("couldn't find"));
      answerOk = c.unanswerable
        ? refused
        : !refused && (c.expect ?? []).every((e) => has(a, e));
      await sleep(2500); // stay under free-tier rate limits
    }

    results.push({
      q: c.q,
      unanswerable: !!c.unanswerable,
      hasEvidence: !!c.evidence,
      evidenceMissing,
      rank,
      answerOk,
      answer,
    });

    const retrievalTag = !c.evidence
      ? "n/a "
      : evidenceMissing
        ? "BAD-PHRASE"
        : rank
          ? `#${rank}`
          : "MISS";
    const answerTag = answerOk === null ? "-" : answerOk ? "PASS" : "FAIL";
    console.log(`${n}. retrieval: ${retrievalTag.padEnd(10)} answer: ${answerTag.padEnd(4)}  ${c.q}`);

    if (answerOk === false) {
      console.log(`      expected: ${c.unanswerable ? "a refusal" : (c.expect ?? []).join(" + ")}`);
      console.log(`      got: ${answer.replace(/\s+/g, " ").slice(0, 300)}`);
    }
    if (evidenceMissing) {
      console.log(`      evidence phrase not found anywhere in the document: "${c.evidence}"`);
    }
  }

  // --- Summary ---
  const scored = results.filter((r) => r.hasEvidence && !r.evidenceMissing);
  const hit = scored.filter((r) => r.rank !== null);
  const hit3 = scored.filter((r) => r.rank !== null && r.rank <= 3);
  const mrr = scored.length
    ? scored.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / scored.length
    : 0;

  const answerable = results.filter((r) => !r.unanswerable && r.answerOk !== null);
  const correct = answerable.filter((r) => r.answerOk);
  const refusals = results.filter((r) => r.unanswerable && r.answerOk !== null);
  const refusedOk = refusals.filter((r) => r.answerOk);

  console.log("\n=== SUMMARY ===");
  console.log(`Questions run: ${results.length}  (skipped: ${skipped})`);
  console.log(`Retrieval hit@${K}: ${hit.length}/${scored.length} (${pct(hit.length, scored.length)})`);
  console.log(`Retrieval hit@3:  ${hit3.length}/${scored.length} (${pct(hit3.length, scored.length)})`);
  console.log(`Mean reciprocal rank: ${mrr.toFixed(3)}`);
  if (!retrievalOnly) {
    console.log(`Answer accuracy: ${correct.length}/${answerable.length} (${pct(correct.length, answerable.length)})`);
    console.log(`Correct refusals: ${refusedOk.length}/${refusals.length} (${pct(refusedOk.length, refusals.length)})`);
  }

  writeFileSync(
    "eval/results.json",
    JSON.stringify({ model: MODEL, k: K, retrievalOnly, results }, null, 2)
  );
  console.log("\nSaved eval/results.json");

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});