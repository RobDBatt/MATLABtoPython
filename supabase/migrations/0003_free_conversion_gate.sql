-- 1 free conversion per email (MATLABtoPython) — anonymous free-tier.
--
-- MATLABtoPython SHARES the vbatopython `subscribers` table (see
-- 001_subscribers.sql) for its email-gate leads. This adds one nullable,
-- explicitly-namespaced column so the flag can never be confused with a
-- future VBAtoPython-side use of the same shared table. NULL = free
-- conversion not yet used; set = the timestamp it was used. Safe to run
-- against the shared project (yziftfflqeqidmktvnhw); touches no other
-- column or table.

alter table subscribers add column if not exists matlab_free_conversion_used_at timestamptz;
