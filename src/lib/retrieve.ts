import { sql } from "./db";
import { embed } from "./embed";

export async function retrieve(question: string, k = 8, documentId?: string) {
  const [qv] = await embed([question]);
  const vec = JSON.stringify(qv);
  const filter = documentId ? sql`and c.document_id = ${documentId}` : sql``;

  return sql`
    select
      c.id, c.content, c.page_number, c.page_end, d.filename,
      1 - (c.embedding <=> ${vec}::vector) as score
    from chunks c
    join documents d on d.id = c.document_id
    where d.status = 'ready' ${filter}
    order by c.embedding <=> ${vec}::vector
    limit ${k}
  `;
}