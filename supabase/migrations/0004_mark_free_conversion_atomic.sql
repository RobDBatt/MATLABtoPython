-- Atomic mark-as-used for the MATLABtoPython free-conversion gate.
--
-- Fixes a race that let the gate never engage. The convert route schedules
-- two writers for the same row in the same request — saveSubscriber's INSERT
-- and markMatlabFreeConversionUsed's PATCH-then-INSERT — and Next's `after()`
-- runs its callbacks on an unbounded p-queue, so they fire concurrently. For a
-- new email the PATCH matched zero rows (the INSERT hadn't committed), fell
-- through to its own INSERT, and hit subscribers_email_key. The 409 was
-- swallowed, so matlab_free_conversion_used_at stayed NULL and the email was
-- never gated. Any check-then-act against a unique constraint has this window;
-- only a single atomic statement closes it.
--
-- coalesce() keeps the FIRST use timestamp, so a repeat call can't slide it
-- forward. DO UPDATE touches only the flag, so an existing row's `source`
-- (e.g. a newsletter signup) survives — same guarantee the old PATCH-first
-- ordering was reaching for. Safe to run against the shared vbatopython
-- project: touches no other column or table.

create or replace function public.mark_matlab_free_conversion_used(
  p_email text,
  p_source text
) returns void
language sql
as $$
  insert into public.subscribers (email, source, matlab_free_conversion_used_at)
  values (p_email, p_source, now())
  on conflict (email) do update
    set matlab_free_conversion_used_at =
      coalesce(subscribers.matlab_free_conversion_used_at, now());
$$;

-- The convert route calls this with the service role key. Nothing else should
-- reach it: EXECUTE defaults to PUBLIC, which would let an anon caller burn an
-- arbitrary stranger's free conversion by pre-marking their email.
revoke execute on function public.mark_matlab_free_conversion_used(text, text) from public;
revoke execute on function public.mark_matlab_free_conversion_used(text, text) from anon;
revoke execute on function public.mark_matlab_free_conversion_used(text, text) from authenticated;
grant execute on function public.mark_matlab_free_conversion_used(text, text) to service_role;
