-- Edit a game's details after it's created. Coaches, admins, and the game's current
-- scorer can change the event, opponent, start time, and location. Only those four
-- columns change, so scorer_id, team_id, and the scorer claim stay put.
create or replace function public.update_game_details(
  p_game uuid,
  p_event_name text,
  p_opponent text,
  p_starts_at timestamptz,
  p_location text
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  g record;
  v_me uuid := public.current_person_id();
begin
  if p_opponent is null or btrim(p_opponent) = '' or p_starts_at is null then
    raise exception 'Opponent and start time are required';
  end if;
  select * into g from public.games where id = p_game;
  if not found then
    return false;
  end if;
  if not (public.is_admin() or public.is_team_staff(g.team_id) or (v_me is not null and g.scorer_id = v_me)) then
    return false;
  end if;
  update public.games
    set event_name = btrim(coalesce(p_event_name, '')),
        opponent = btrim(p_opponent),
        starts_at = p_starts_at,
        location = btrim(coalesce(p_location, ''))
    where id = p_game;
  return found;
end;
$$;

revoke execute on function public.update_game_details(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.update_game_details(uuid, text, text, timestamptz, text) to authenticated;
