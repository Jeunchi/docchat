import { NextResponse } from "next/server";
import { ingestPdf } from "@/lib/ingest";
import { sql } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Upload a PDF file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (10 MB max)." }, { status: 413 });
  }

  try {
    const result = await ingestPdf(new Uint8Array(await file.arrayBuffer()), file.name);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const docs = await sql`
    select id, filename, status, created_at from documents order by created_at desc
  `;
  return NextResponse.json(docs);
}