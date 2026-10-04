create table if not exists usage_events (
  id bigserial primary key,
  user_id text not null references "user"(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_lookup_idx
  on usage_events (user_id, kind, created_at desc);
create index if not exists usage_events_kind_time_idx
  on usage_events (kind, created_at desc);