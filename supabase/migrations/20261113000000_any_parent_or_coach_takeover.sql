-- Anyone who can see a game as a parent, coach, or admin can start scoring a free game
-- or take over a game someone else is scoring. Takeover no longer needs the team's
-- default scorer. Clearing still works for the scorer, admins, and coaches.
create or replace function public.game_scorer_status(p_game uuid)
returns table (scorer_id uuid, scorer_name text, is_me boolean, can_claim boolean, can_take_over boolean, can_release boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := public.current_person_id();
  v_team uuid;
  v_scorer uuid;
  v_can_score boolean;
begin
  select g.team_id, g.scorer_id into v_team, v_scorer
  from public.games g where g.id = p_game;
  if v_team is null or not public.is_team_member(v_team) then
    return;
  end if;
  v_can_score := public.is_team_parent(v_team) or public.is_team_staff(v_team) or public.is_admin();
  return query select
    v_scorer,
    coalesce((select nullif(p.name, '') from public.people p where p.id = v_scorer), case when v_scorer is null then null else 'Another parent' end),
    v_scorer is not null and v_scorer = v_me,
    v_can_score and v_scorer is null,
    v_can_score and v_scorer is not null and v_scorer <> v_me,
    v_scorer is not null and (v_scorer = v_me or public.is_admin() or public.is_team_staff(v_team));
end;
$$;
