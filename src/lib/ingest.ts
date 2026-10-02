import { extractText, getDocumentProxy } from "unpdf";
import { sql } from "./db";
import { embed } from "./embed";
import { chunkPages } from "./chunk";

export async function ingestPdf(data: Uint8Array, filename: string) {
  const [doc] = await sql`
    insert into documents (filename) values (${filename}) returning id
  `;

  try {
    const pdf = await getDocumentProxy(data);
    const { text: pages } = await extractText(pdf, { mergePages: false });

    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new Error("No extractable text found (is this a scanned PDF?)");
    }

    const vectors = await embed(chunks.map((c) => c.content));

    await sql.begin(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx`
          insert into chunks (document_id, content, page_number, chunk_index, embedding)
          values (
            ${doc.id}, ${chunks[i].content}, ${chunks[i].pageNumber},
            ${chunks[i].chunkIndex}, ${JSON.stringify(vectors[i])}::vector
          )
        `;
      }
    });

    await sql`update documents set status = 'ready' where id = ${doc.id}`;
    return { documentId: doc.id as string, chunks: chunks.length };
  } catch (err) {
    await sql`update documents set status = 'failed' where id = ${doc.id}`;
    throw err;
  }
}