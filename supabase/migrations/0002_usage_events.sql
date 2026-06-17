-- Customer-pattern telemetry — usage_events (MATLABtoPython).
--
-- MATLABtoPython SHARES the vbatopython Supabase project for this table; rows
-- are tagged `site = 'matlab'`. This file documents the shared schema and is
-- idempotent — the table is first created by the vbatopython migration, and the
-- `site` column is added by the statement below. Safe to run against the shared
-- project (yziftfflqeqidmktvnhw); touches no other table.
--
-- Records WHICH MATLAB functions/toolboxes users paste (closed vocabulary IDs
-- from src/lib/telemetry/catalog.ts only) plus flag-type counts — never source
-- code, identity, or IPs. Insert-only via the service role.

create table if not exists usage_events (
  id           bigserial primary key,
  session_id   uuid not null,
  ts           timestamptz not null default now(),
  event_type   text not null,          -- 'preflight' | 'convert_success' | 'convert_failure'
  target       text,                   -- MATLAB: conversion mode 'paste' | 'upload' | 'batch'
  lines_bucket text,                   -- '1-100' | '101-500' | '501-2000' | '2001-5000' | '5000+'
  features     jsonb,                  -- [{ "id": "fft", "count": 3 }, ...]  (catalog IDs only)
  warnings     jsonb,                  -- [{ "id": "unsupported", "count": 2 }, ...]  (flag-type IDs only)
  consent_v    int not null default 1,
  site         text not null default 'vba'
);

alter table usage_events add column if not exists site text not null default 'vba';

create index if not exists idx_usage_ts on usage_events (ts desc);
create index if not exists idx_usage_event_type on usage_events (event_type);
create index if not exists idx_usage_site on usage_events (site);

-- RLS: only the service role may insert or select.
alter table usage_events enable row level security;

drop policy if exists "service insert" on usage_events;
create policy "service insert" on usage_events for insert
  to service_role with check (true);

drop policy if exists "service select" on usage_events;
create policy "service select" on usage_events for select
  to service_role using (true);
