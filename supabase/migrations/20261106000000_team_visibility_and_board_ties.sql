-- Team visibility (admins can hide a team from parents), and hustle board ties.

-- ---------------------------------------------------------------------------
-- Team visibility
-- ---------------------------------------------------------------------------

-- Public teams (the default) are visible to parents and show on the Hustle Board.
-- Hidden teams are readable only by the team's coaches and admins.
alter table public.teams add column is_public boolean not null default true;

create or replace function public.team_is_public(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select t.is_public from public.teams t where t.id = p_team), false)
$$;

-- Parents lose access to hidden teams. Coaches and admins keep it.
create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
    or public.is_team_staff(p_team)
    or (public.is_team_parent(p_team) and public.team_is_public(p_team))
$$;

-- Hustle board: skip hidden teams for everyone except their coaches and admins.
-- Ties: players with the same total share a rank (1, 2, 2, 4), so every tied
-- player shows. Players who are tied on the cut line all appear.
create or replace function public.hustle_board(p_season uuid default null)
returns table (team_id uuid, team_name text, rank int, player_label text, jersey_number text, points int, games int)
language sql stable security definer set search_path = '' as $$
  with season as (
    select coalesce(p_season, (select id from public.seasons where is_active limit 1)) as id
  ),
  totals as (
    select t.id as team_id, t.name as team_name, p.id as player_id,
      trim(p.first_name || ' ' || left(p.last_name, 1)) as player_label,
      p.jersey_number,
      coalesce(sum(e.points), 0)::int as points,
      count(distinct e.game_id)::int as games
    from public.teams t
    join season s on s.id = t.season_id
    join public.players p on p.team_id = t.id and p.active
    left join public.hustle_events e on e.player_id = p.id and e.voided_at is null
    where auth.uid() is not null
      and (t.is_public or public.is_admin() or public.is_team_staff(t.id))
    group by t.id, t.name, p.id
  ),
  ranked as (
    select *, rank() over (partition by team_id order by points desc) as rk
    from totals
  )
  select team_id, team_name, rk::int, player_label, jersey_number, points, games
  from ranked where rk <= 3
  order by team_name, rk, player_label
$$;
