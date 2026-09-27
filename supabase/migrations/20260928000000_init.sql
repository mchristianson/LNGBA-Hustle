-- LNGBA Hustle Tracker: initial schema, security rules and functions.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index seasons_one_active on public.seasons (is_active) where is_active;

-- Everyone on a roster: parents, coaches, admins. Linked to auth.users on first login.
create table public.people (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null default '',
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index people_email_key on public.people (lower(email));

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  name text not null,
  -- The parent who normally runs the app for this team.
  default_scorer_id uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (season_id, name)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  jersey_number text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index players_team_name_key
  on public.players (team_id, lower(first_name), lower(last_name));

create table public.guardians (
  player_id uuid not null references public.players (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (player_id, person_id)
);
create index guardians_person_idx on public.guardians (person_id);

create table public.team_staff (
  team_id uuid not null references public.teams (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role text not null default 'coach' check (role in ('head_coach', 'coach')),
  primary key (team_id, person_id)
);
create index team_staff_person_idx on public.team_staff (person_id);

create table public.admins (
  person_id uuid primary key references public.people (id) on delete cascade
);

-- Invite links. Only the SHA-256 hash of the token is stored.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  sent_at timestamptz,
  accepted_at timestamptz,
  flagged_at timestamptz
);
create index invites_person_idx on public.invites (person_id);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  opponent text not null,
  starts_at timestamptz not null,
  location text not null default '',
  event_name text not null default '',
  scorer_id uuid references public.people (id) on delete set null,
  scorer_claimed_at timestamptz,
  created_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now()
);
create index games_team_start_idx on public.games (team_id, starts_at);

create table public.hustle_actions (
  code text primary key,
  label text not null,
  points int not null,
  sort_order int not null
);
insert into public.hustle_actions (code, label, points, sort_order) values
  ('R', 'Rebound', 1, 1),
  ('S', 'Steal', 1, 2),
  ('B', 'Block', 1, 3),
  ('D', 'Deflection', 1, 4),
  ('C', 'Charge', 3, 5),
  ('A', 'Assist', 2, 6),
  ('T', 'Turnover', -2, 7);

-- One row per button tap. Undo sets voided_at. Ids are generated on the phone so
-- an offline retry never inserts twice.
create table public.hustle_events (
  id uuid primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  action_code text not null references public.hustle_actions (code),
  points int not null,
  recorded_by uuid not null references public.people (id),
  client_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  voided_at timestamptz
);
create index hustle_events_game_idx on public.hustle_events (game_id);
create index hustle_events_player_idx on public.hustle_events (player_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------

create or replace function public.current_person_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.people where auth_user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    join public.people p on p.id = a.person_id
    where p.auth_user_id = auth.uid()
  )
$$;

create or replace function public.is_team_parent(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.guardians g
    join public.players pl on pl.id = g.player_id
    join public.people pe on pe.id = g.person_id
    where pl.team_id = p_team and pe.auth_user_id = auth.uid()
  )
$$;

create or replace function public.is_team_staff(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_staff s
    join public.people pe on pe.id = s.person_id
    where s.team_id = p_team and pe.auth_user_id = auth.uid()
  )
$$;

create or replace function public.is_team_member(p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_team_parent(p_team) or public.is_team_staff(p_team)
$$;

create or replace function public.game_team(p_game uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select team_id from public.games where id = p_game
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.seasons enable row level security;
alter table public.people enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.guardians enable row level security;
alter table public.team_staff enable row level security;
alter table public.admins enable row level security;
alter table public.invites enable row level security;
alter table public.games enable row level security;
alter table public.hustle_actions enable row level security;
alter table public.hustle_events enable row level security;

-- Admins manage everything.
create policy admin_all on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.people for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.players for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.guardians for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.team_staff for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.admins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.invites for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.games for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.hustle_actions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.hustle_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Everyone signed in reads seasons and the scoring key.
create policy read_all on public.seasons for select to authenticated using (true);
create policy read_all on public.hustle_actions for select to authenticated using (true);

-- People see only themselves. Names of others come through functions.
create policy read_self on public.people for select to authenticated
  using (auth_user_id = auth.uid());
create policy read_self on public.admins for select to authenticated
  using (person_id = public.current_person_id());
create policy read_self on public.guardians for select to authenticated
  using (person_id = public.current_person_id());

-- Team data: members only.
create policy team_read on public.teams for select to authenticated
  using (public.is_team_member(id));
create policy team_read on public.players for select to authenticated
  using (public.is_team_member(team_id));
create policy team_read on public.team_staff for select to authenticated
  using (public.is_team_member(team_id));
create policy team_read on public.games for select to authenticated
  using (public.is_team_member(team_id));

-- Coaches add and edit their team's games. Scorer changes go through functions.
create policy staff_insert on public.games for insert to authenticated
  with check (public.is_team_staff(team_id) and scorer_id is null);
create policy staff_update on public.games for update to authenticated
  using (public.is_team_staff(team_id)) with check (public.is_team_staff(team_id));
create policy staff_delete on public.games for delete to authenticated
  using (public.is_team_staff(team_id));

-- Hustle events: team members read. Only the game's current scorer inserts.
create policy team_read on public.hustle_events for select to authenticated
  using (public.is_team_member(public.game_team(game_id)));
create policy scorer_insert on public.hustle_events for insert to authenticated
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_id and g.scorer_id = public.current_person_id()
    )
  );
-- Scorers undo their own taps for 24 hours. Admins fix anything after that.
create policy scorer_void on public.hustle_events for update to authenticated
  using (recorded_by = public.current_person_id() and created_at > now() - interval '24 hours')
  with check (recorded_by = public.current_person_id());

revoke update on public.hustle_events from authenticated;
grant update (voided_at) on public.hustle_events to authenticated;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Points and recorder come from the server, never from the phone.
create or replace function public.hustle_events_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_points int;
begin
  select points into v_points from public.hustle_actions where code = new.action_code;
  if v_points is null then
    raise exception 'Unknown hustle action %', new.action_code;
  end if;
  if not exists (
    select 1 from public.players p join public.games g on g.team_id = p.team_id
    where p.id = new.player_id and g.id = new.game_id
  ) then
    raise exception 'Player is not on this game''s team';
  end if;
  new.points := v_points;
  new.created_at := now();
  if auth.uid() is not null then
    new.recorded_by := public.current_person_id();
  end if;
  return new;
end;
$$;
create trigger hustle_events_before_insert before insert on public.hustle_events
  for each row execute function public.hustle_events_before_insert();

-- Link a new login to the roster entry with the same email.
create or replace function public.link_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.people set auth_user_id = new.id
  where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.link_auth_user();

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Who is scoring this game, and what the caller may do about it.
create or replace function public.game_scorer_status(p_game uuid)
returns table (scorer_id uuid, scorer_name text, is_me boolean, can_claim boolean, can_take_over boolean, can_release boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_me uuid := public.current_person_id();
  v_team uuid;
  v_scorer uuid;
  v_default uuid;
  v_parent boolean;
begin
  select g.team_id, g.scorer_id, t.default_scorer_id into v_team, v_scorer, v_default
  from public.games g join public.teams t on t.id = g.team_id where g.id = p_game;
  if v_team is null or not public.is_team_member(v_team) then
    return;
  end if;
  v_parent := public.is_team_parent(v_team) or public.is_admin();
  return query select
    v_scorer,
    coalesce((select nullif(p.name, '') from public.people p where p.id = v_scorer), case when v_scorer is null then null else 'Another parent' end),
    v_scorer is not null and v_scorer = v_me,
    v_parent and v_scorer is null,
    v_parent and v_scorer is not null and v_scorer <> v_me and (public.is_admin() or v_default = v_me),
    v_scorer is not null and (v_scorer = v_me or public.is_admin() or public.is_team_staff(v_team));
end;
$$;

-- "I'm scoring this game." Take-over is for the team's default scorer and admins.
create or replace function public.claim_scorer(p_game uuid, p_take_over boolean default false)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := public.current_person_id();
  s record;
begin
  select * into s from public.game_scorer_status(p_game);
  if not found or v_me is null then
    return false;
  end if;
  if s.is_me then
    return true;
  end if;
  if s.can_claim or (p_take_over and s.can_take_over) then
    update public.games set scorer_id = v_me, scorer_claimed_at = now()
    where id = p_game and (scorer_id is null or p_take_over);
    return found;
  end if;
  return false;
end;
$$;

create or replace function public.release_scorer(p_game uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  s record;
begin
  select * into s from public.game_scorer_status(p_game);
  if not found or not s.can_release then
    return false;
  end if;
  update public.games set scorer_id = null, scorer_claimed_at = null where id = p_game;
  return true;
end;
$$;

-- Top 3 per team for the season, visible to every signed-in user.
-- Names are first name + last initial.
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
    group by t.id, t.name, p.id
  ),
  ranked as (
    select *, row_number() over (partition by team_id order by points desc, player_label) as rn
    from totals
  )
  select team_id, team_name, rn::int, player_label, jersey_number, points, games
  from ranked where rn <= 3
  order by team_name, rn
$$;

-- ---------------------------------------------------------------------------
-- Views (security_invoker so the caller's RLS applies)
-- ---------------------------------------------------------------------------

create view public.player_game_totals with (security_invoker = true) as
select
  e.game_id,
  e.player_id,
  sum(e.points)::int as points,
  count(*) filter (where e.action_code = 'R')::int as r,
  count(*) filter (where e.action_code = 'S')::int as s,
  count(*) filter (where e.action_code = 'B')::int as b,
  count(*) filter (where e.action_code = 'D')::int as d,
  count(*) filter (where e.action_code = 'C')::int as c,
  count(*) filter (where e.action_code = 'A')::int as a,
  count(*) filter (where e.action_code = 'T')::int as t
from public.hustle_events e
where e.voided_at is null
group by e.game_id, e.player_id;

-- Games = games with at least one hustle play recorded for the player.
create view public.player_season_totals with (security_invoker = true) as
select
  p.team_id,
  p.id as player_id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  coalesce(sum(t.points), 0)::int as points,
  count(t.game_id)::int as games,
  coalesce(sum(t.r), 0)::int as r,
  coalesce(sum(t.s), 0)::int as s,
  coalesce(sum(t.b), 0)::int as b,
  coalesce(sum(t.d), 0)::int as d,
  coalesce(sum(t.c), 0)::int as c,
  coalesce(sum(t.a), 0)::int as a,
  coalesce(sum(t.t), 0)::int as t
from public.players p
left join public.player_game_totals t on t.player_id = p.id
where p.active
group by p.team_id, p.id;

grant select on public.player_game_totals, public.player_season_totals to authenticated;

-- Function execute rights: signed-in users only.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.current_person_id(), public.is_admin(), public.is_team_parent(uuid),
  public.is_team_staff(uuid), public.is_team_member(uuid), public.game_team(uuid),
  public.game_scorer_status(uuid), public.claim_scorer(uuid, boolean),
  public.release_scorer(uuid), public.hustle_board(uuid)
  to authenticated;

-- Live updates for the scoring screen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.hustle_events, public.games;
  end if;
end;
$$;
