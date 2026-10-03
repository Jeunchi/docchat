import { NextResponse } from "next/server";
import { ingestPdf } from "@/lib/ingest";
import { getUserId } from "@/lib/session";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Real PDFs start with the bytes "%PDF".
function looksLikePdf(b: Uint8Array) {
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (10 MB max)." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) {
    return NextResponse.json({ error: "That doesn't look like a valid PDF." }, { status: 400 });
  }

  try {
    const result = await ingestPdf(userId, bytes, file.name.slice(0, 200));
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const docs = await sql`
    select id, filename, status, created_at
    from documents
    where user_id = ${userId}
    order by created_at desc
  `;
  return NextResponse.json(docs);
}