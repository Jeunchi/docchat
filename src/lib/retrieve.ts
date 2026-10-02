import { sql } from "./db";
import { embed } from "./embed";

export async function retrieve(question: string, k = 5) {
  const [qv] = await embed([question]);
  const vec = JSON.stringify(qv);

  return sql`
    select
      c.id, c.content, c.page_number, d.filename,
      1 - (c.embedding <=> ${vec}::vector) as score
    from chunks c
    join documents d on d.id = c.document_id
    where d.status = 'ready'
    order by c.embedding <=> ${vec}::vector
    limit ${k}
  `;
}