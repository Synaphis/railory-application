-- ============================================================
-- Railory — Atomic check-and-increment usage RPC
--
-- Replaces the two-step "increment → read → maybe rollback" dance
-- with a single locked operation. Eliminates the race where two
-- concurrent requests could both be incorrectly allowed or both
-- incorrectly rejected at the limit boundary.
--
-- Run once in the Supabase SQL editor for the live project.
-- ============================================================

create or replace function public.check_and_increment_usage(
  p_user_id uuid,
  p_period  text,
  p_field   text,
  p_limit   int
)
returns table(allowed bool, new_count int)
language plpgsql
security definer
as $$
declare
  v_current int;
begin
  -- Ensure a row exists so the row lock has something to bite on.
  insert into public.usage (user_id, period)
  values (p_user_id, p_period)
  on conflict (user_id, period) do nothing;

  -- Lock the row and read the current counter for this field.
  -- Concurrent callers wait here until the current transaction commits.
  if p_field = 'generations' then
    select generations into v_current
      from public.usage
      where user_id = p_user_id and period = p_period
      for update;

    if v_current >= p_limit then
      return query select false, v_current;
      return;
    end if;

    update public.usage
      set generations = generations + 1, updated_at = now()
      where user_id = p_user_id and period = p_period;

    return query select true, v_current + 1;

  elsif p_field = 'try_ons' then
    select try_ons into v_current
      from public.usage
      where user_id = p_user_id and period = p_period
      for update;

    if v_current >= p_limit then
      return query select false, v_current;
      return;
    end if;

    update public.usage
      set try_ons = try_ons + 1, updated_at = now()
      where user_id = p_user_id and period = p_period;

    return query select true, v_current + 1;

  else
    raise exception 'check_and_increment_usage: unknown field %', p_field;
  end if;
end;
$$;

-- Grant execute to the roles that need it. Service role bypasses all
-- of this anyway, but being explicit doesn't hurt.
grant execute on function public.check_and_increment_usage(uuid, text, text, int)
  to service_role;
