-- Public home: signed-out visitors see the team list and the Hustle Board.
-- Schedules, leaderboards, and point detail still need a login.

-- Team names for the active season, public teams only.
create or replace function public.public_teams()
returns table (team_id uuid, team_name text, season_name text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, s.name
  from public.teams t
  join public.seasons s on s.id = t.season_id
  where s.is_active and t.is_public
  order by t.name
$$;

-- Hustle board, now callable without a login. Hidden teams are still skipped
-- for everyone except their coaches and admins.
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
    where (t.is_public or public.is_admin() or public.is_team_staff(t.id))
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

revoke execute on function public.public_teams(), public.hustle_board(uuid) from public;
grant execute on function public.public_teams(), public.hustle_board(uuid) to anon, authenticated;
