create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  status text not null default 'processing',
  created_at timestamptz default now()
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  page_number int,
  page_end int,
  chunk_index int not null,
  embedding vector(384)
);

create index on chunks using hnsw (embedding vector_cosine_ops);
alter table chunks add column if not exists fts tsvector generated always as (to_tsvector('english', content)) stored;
create index if not exists chunks_fts_idx on chunks using gin (fts);


$env:DATABASE_URL="postgresql://neondb_owner:npg_KvD7k4GBxOpn@ep-wandering-forest-b77c3iw8-pooler.c-13.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
npx auth@latest migrate
