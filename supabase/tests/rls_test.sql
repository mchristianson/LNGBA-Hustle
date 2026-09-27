-- Run after supabase_stub.sql and the migrations. Raises on any failed check.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'angie@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'parent1@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'parent2@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'coach@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'other@example.com');
-- People inserted after users: link manually (trigger covers the other order).
insert into public.people (id, email, name, auth_user_id) values
  ('10000000-0000-0000-0000-00000000000a', 'angie@example.com', 'Angie', '00000000-0000-0000-0000-00000000000a');
insert into public.admins values ('10000000-0000-0000-0000-00000000000a');
insert into public.seasons (id, name, starts_on, ends_on, is_active) values
  ('20000000-0000-0000-0000-000000000001', '2026-27', '2026-10-01', '2027-03-31', true);
insert into public.teams (id, season_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '12U Red'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '14U Black');
insert into public.players (id, team_id, first_name, last_name, jersey_number) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Emma', 'Johnson', '12'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Ava', 'Kim', '23'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Mia', 'Lopez', '5');
-- Roster people created before they log in; trigger links them later.
delete from auth.users where email in ('parent1@example.com','parent2@example.com','coach@example.com','other@example.com');
insert into public.people (id, email, name) values
  ('10000000-0000-0000-0000-00000000000b', 'Parent1@example.com', 'Pat One'),
  ('10000000-0000-0000-0000-00000000000c', 'parent2@example.com', 'Pat Two'),
  ('10000000-0000-0000-0000-00000000000d', 'coach@example.com', 'Coach Carter'),
  ('10000000-0000-0000-0000-00000000000e', 'other@example.com', 'Other Parent');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'parent1@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'parent2@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'coach@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'other@example.com');
do $$ begin
  if (select count(*) from public.people where auth_user_id is not null) <> 5 then
    raise exception 'FAIL: auth trigger did not link people';
  end if;
end $$;
insert into public.guardians values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000b'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000c'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000e');
insert into public.team_staff values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000d', 'head_coach');
update public.teams set default_scorer_id = '10000000-0000-0000-0000-00000000000c' where id = '30000000-0000-0000-0000-000000000001';

create function pg_temp.act_as(uid text) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid, false);
$$;
create function pg_temp.check(ok boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- Coach adds a game.
set role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d');
insert into public.games (id, team_id, opponent, starts_at) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Prior Lake', now());
select pg_temp.check((select count(*) from public.games) = 1, 'coach sees own team game');
select pg_temp.check((select can_claim from public.game_scorer_status('50000000-0000-0000-0000-000000000001')) = false, 'coach cannot claim scorer');
select pg_temp.check(public.claim_scorer('50000000-0000-0000-0000-000000000001') = false, 'coach claim refused');

-- Other team's parent sees nothing.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(*) from public.games) = 0, 'other team parent sees no games');
select pg_temp.check((select count(*) from public.players) = 1, 'other team parent sees only own players');
select pg_temp.check((select count(*) from public.people) = 1, 'people: only self');

-- Parent 1 claims scorer and records taps.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.claim_scorer('50000000-0000-0000-0000-000000000001'), 'parent1 claims scorer');
insert into public.hustle_events (id, game_id, player_id, action_code, points, recorded_by) values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'C', 99, '10000000-0000-0000-0000-00000000000e'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'R', 1, '10000000-0000-0000-0000-00000000000b'),
  ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'T', 1, '10000000-0000-0000-0000-00000000000b');
select pg_temp.check((select points from public.hustle_events where id = '60000000-0000-0000-0000-000000000001') = 3, 'server sets points (charge = 3)');
select pg_temp.check((select recorded_by from public.hustle_events where id = '60000000-0000-0000-0000-000000000001') = '10000000-0000-0000-0000-00000000000b', 'server sets recorder');
-- Offline retry of the same id is ignored.
insert into public.hustle_events (id, game_id, player_id, action_code, points, recorded_by) values
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'R', 1, '10000000-0000-0000-0000-00000000000b')
  on conflict (id) do nothing;
update public.hustle_events set voided_at = now() where id = '60000000-0000-0000-0000-000000000002';
select pg_temp.check((select points from public.player_game_totals where player_id = '40000000-0000-0000-0000-000000000001') = 3, 'undo removes rebound from total');
select pg_temp.check((select points from public.player_game_totals where player_id = '40000000-0000-0000-0000-000000000002') = -2, 'turnover = -2');
do $$ begin
  begin
    update public.hustle_events set points = 50 where id = '60000000-0000-0000-0000-000000000001';
    raise exception 'FAIL: scorer changed points';
  exception when insufficient_privilege then raise notice 'ok: scorer cannot change points';
  end;
end $$;

-- Parent 2 (not scorer) cannot insert, but sees totals. Default scorer can take over.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  begin
    insert into public.hustle_events (id, game_id, player_id, action_code, points, recorded_by) values
      (gen_random_uuid(), '50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'S', 1, '10000000-0000-0000-0000-00000000000c');
    raise exception 'FAIL: non-scorer inserted';
  exception when insufficient_privilege then raise notice 'ok: non-scorer insert refused';
  end;
end $$;
select pg_temp.check((select count(*) from public.hustle_events) = 3, 'parent2 reads team events');
select pg_temp.check((select scorer_name from public.game_scorer_status('50000000-0000-0000-0000-000000000001')) = 'Pat One', 'scorer name visible');
select pg_temp.check((select can_take_over from public.game_scorer_status('50000000-0000-0000-0000-000000000001')), 'default scorer may take over');
select pg_temp.check(public.claim_scorer('50000000-0000-0000-0000-000000000001', true), 'default scorer takes over');
update public.hustle_events set voided_at = now() where id = '60000000-0000-0000-0000-000000000001';
select pg_temp.check((select voided_at from public.hustle_events where id = '60000000-0000-0000-0000-000000000001') is null, 'cannot undo someone else''s tap');

-- Hustle board: other team parent sees top 3 of every team.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000e');
select pg_temp.check((select count(distinct team_id) from public.hustle_board()) = 2, 'hustle board shows all teams');
select pg_temp.check((select player_label from public.hustle_board() where team_name = '12U Red' and rank = 1) = 'Emma J', 'board uses last initial');
select pg_temp.check((select count(*) from public.player_season_totals) = 1, 'season totals limited to own team');


-- Roster import: admin only, idempotent.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select public.import_roster('20000000-0000-0000-0000-000000000001', '[
  {"team":"12U Red","jersey":"12","first_name":"Emma","last_name":"Johnson","parents":[{"name":"Pat One","email":"PARENT1@example.com"},{"name":"New Dad","email":"dad@example.com"}]},
  {"team":"10U White","jersey":"3","first_name":"Zoe","last_name":"Park","parents":[{"name":"Zoe Mom","email":"zmom@example.com"}],"coaches":[{"name":"Coach Z","email":"coachz@example.com"}]}
]'::jsonb);
select public.import_roster('20000000-0000-0000-0000-000000000001', '[
  {"team":"10U White","jersey":"3","first_name":"zoe","last_name":"park","parents":[{"name":"Zoe Mom","email":"zmom@example.com"}]}
]'::jsonb);
select pg_temp.check((select count(*) from public.teams) = 3, 'import adds one new team');
select pg_temp.check((select count(*) from public.players) = 4, 'import is idempotent for players');
select pg_temp.check((select count(*) from public.guardians where player_id = '40000000-0000-0000-0000-000000000001') = 2, 'import links second parent');
select pg_temp.check((select count(*) from public.team_staff) = 2, 'import adds coach');
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  begin
    perform public.import_roster('20000000-0000-0000-0000-000000000001', '[]'::jsonb);
    raise exception 'FAIL: parent imported';
  exception when insufficient_privilege then raise notice 'ok: parent cannot import';
  end;
end $$;

-- Anonymous sees nothing.
reset role;
set role anon;
select pg_temp.act_as('');
do $$ begin
  begin
    perform count(*) from public.games;
    raise exception 'FAIL: anon read games';
  exception when insufficient_privilege then raise notice 'ok: anon blocked';
  end;
end $$;
reset role;
\echo ALL RLS CHECKS PASSED
