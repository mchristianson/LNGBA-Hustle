-- The scoring key (what each hustle play is worth) for the public Hustle Board legend.
-- hustle_actions is readable only by signed-in users, so this function exposes just the key.

create or replace function public.public_scoring_key()
returns table (code text, label text, points int)
language sql stable security definer set search_path = '' as $$
  select a.code, a.label, a.points
  from public.hustle_actions a
  order by a.sort_order
$$;

revoke execute on function public.public_scoring_key() from public;
grant execute on function public.public_scoring_key() to anon, authenticated;
