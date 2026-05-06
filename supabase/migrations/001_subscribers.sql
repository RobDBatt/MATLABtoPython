-- Email capture table for mtopython.com newsletter signups.
-- Run this once in your Supabase SQL editor, or via the CLI:
--   supabase db push
--
-- The /api/subscribe endpoint writes rows here via the REST API.

create table if not exists public.subscribers (
  id bigserial primary key,
  email text unique not null,
  source text,
  created_at timestamp with time zone default now()
);

create index if not exists subscribers_email_idx on public.subscribers (email);
create index if not exists subscribers_created_at_idx on public.subscribers (created_at desc);

-- RLS: block anon reads; only service role (or your own queries) can list.
-- The /api/subscribe route uses the service role key, so inserts still work.
alter table public.subscribers enable row level security;

-- Allow anonymous inserts (used by the public signup form via service key)
-- Note: we use the service role key server-side, so anon policies are
-- belt-and-suspenders — the key is what actually authorizes the write.
create policy "allow service insert"
  on public.subscribers for insert
  with check (true);

-- Export view for convenient dashboards (exclude nothing sensitive yet)
create or replace view public.subscribers_export as
  select email, source, created_at from public.subscribers order by created_at desc;
