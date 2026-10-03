import { sql } from "./db";
import { embed } from "./embed";

// Turns a question into "word1 or word2 or ..." for websearch_to_tsquery.
// Keeping only letters, digits and decimals means user input can't break the query syntax.
function keywordQuery(question: string) {
  const tokens = question.match(/[A-Za-z0-9]+(?:\.[0-9]+)?/g) ?? [];
  const unique = [...new Set(tokens.map((t) => t.toLowerCase()))];
  return unique.filter((t) => t !== "or" && t !== "and").join(" or ");
}

// Hybrid search: vector similarity + full-text search, merged with
// reciprocal rank fusion (score = 1/(60+rank) from each list, summed).
export async function retrieve(question: string, k = 8, documentId?: string) {
  const [qv] = await embed([question]);
  const vec = JSON.stringify(qv);
  const words = keywordQuery(question);
  const filter = documentId ? sql`and c.document_id = ${documentId}` : sql``;

  return sql`
    with vec_hits as (
      select c.id,
             row_number() over (order by c.embedding <=> ${vec}::vector) as r
      from chunks c
      join documents d on d.id = c.document_id
      where d.status = 'ready' ${filter}
      order by c.embedding <=> ${vec}::vector
      limit 30
    ),
    kw_hits as (
      select c.id,
             row_number() over (order by ts_rank_cd(c.fts, q.tsq) desc) as r
      from chunks c
      join documents d on d.id = c.document_id
      cross join (select websearch_to_tsquery('english', ${words}) as tsq) q
      where d.status = 'ready' ${filter} and c.fts @@ q.tsq
      order by ts_rank_cd(c.fts, q.tsq) desc
      limit 30
    )
    select
      c.id, c.content, c.page_number, c.page_end, d.filename,
      1 - (c.embedding <=> ${vec}::vector) as score
    from chunks c
    join documents d on d.id = c.document_id
    left join vec_hits vh on vh.id = c.id
    left join kw_hits kh on kh.id = c.id
    where vh.id is not null or kh.id is not null
    order by coalesce(1.0 / (60 + vh.r), 0) + coalesce(1.0 / (60 + kh.r), 0) desc
    limit ${k}
  `;
}