-- Run after Better Auth's migrate has created the "user" table.
alter table documents add column if not exists user_id text references "user"(id) on delete cascade;

-- Existing documents belong to the first account created (yours).
update documents
set user_id = (select id from "user" order by "createdAt" asc limit 1)
where user_id is null;

alter table documents alter column user_id set not null;
create index if not exists documents_user_id_idx on documents (user_id);