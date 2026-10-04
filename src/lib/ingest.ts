import { extractText, getDocumentProxy } from "unpdf";
import { sql } from "./db";
import { embed } from "./embed";
import { chunkPages } from "./chunk";
import { MAX_PDF_PAGES } from "./limits";

export async function ingestPdf(userId: string, data: Uint8Array, filename: string) {
  const [doc] = await sql`
    insert into documents (filename, user_id) values (${filename}, ${userId}) returning id
  `;

  try {
    const pdf = await getDocumentProxy(data);
    const { text: pages } = await extractText(pdf, { mergePages: false });

    if (pages.length > MAX_PDF_PAGES) {
      throw new Error(`That PDF has too many pages (${MAX_PDF_PAGES} max).`);
    }

    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new Error("No extractable text found (is this a scanned PDF?)");
    }

    const vectors = await embed(chunks.map((c) => c.content));

    await sql.begin(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx`
          insert into chunks (document_id, content, page_number, page_end, chunk_index, embedding)
          values (
            ${doc.id}, ${chunks[i].content}, ${chunks[i].pageNumber}, ${chunks[i].pageEnd},
            ${chunks[i].chunkIndex}, ${JSON.stringify(vectors[i])}::vector
          )
        `;
      }
    });

    await sql`update documents set status = 'ready' where id = ${doc.id}`;
    return { documentId: doc.id as string, chunks: chunks.length };
  } catch (err) {
    // Remove the half-created document (its chunks go with it).
    await sql`delete from documents where id = ${doc.id}`;
    throw err;
  }
}