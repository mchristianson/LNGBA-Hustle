-- Game-by-game top 3 for the public Hustle Board, per team.
-- Past games on public teams only. Games with no plays still appear (rank is null).
-- Full per-player plays stay signed-in and scorer-only.

drop function if exists public.public_game_board();

create or replace function public.public_game_board()
returns table (game_id uuid, team_id uuid, team_name text, opponent text, starts_at timestamptz, rank int, player_label text, jersey_number text, points int)
language sql stable security definer set search_path = '' as $$
  with season as (
    select id from public.seasons where is_active limit 1
  ),
  games as (
    select g.id, g.team_id, g.opponent, g.starts_at, t.name as team_name
    from public.games g
    join public.teams t on t.id = g.team_id
    join season s on s.id = t.season_id
    where t.is_public and g.starts_at < now()
  ),
  totals as (
    select g.id as game_id, g.team_id, g.team_name, g.opponent, g.starts_at, p.id as player_id,
      trim(p.first_name || ' ' || left(p.last_name, 1)) as player_label,
      p.jersey_number,
      coalesce(sum(e.points), 0)::int as points
    from games g
    join public.players p on p.team_id = g.team_id and p.active
    left join public.hustle_events e
      on e.game_id = g.id and e.player_id = p.id and e.voided_at is null
    group by g.id, g.team_id, g.team_name, g.opponent, g.starts_at, p.id, p.first_name, p.last_name, p.jersey_number
  ),
  ranked as (
    select *, rank() over (partition by game_id order by points desc) as rk
    from totals
    where points > 0
  )
  select g.id, g.team_id, g.team_name, g.opponent, g.starts_at, r.rk::int, r.player_label, r.jersey_number, r.points
  from games g
  left join ranked r on r.game_id = g.id and r.rk <= 3
  order by g.starts_at desc, g.team_name, r.rk, r.player_label
$$;

revoke execute on function public.public_game_board() from public;
grant execute on function public.public_game_board() to anon, authenticated;
