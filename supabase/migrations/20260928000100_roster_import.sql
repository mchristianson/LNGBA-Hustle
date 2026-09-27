-- Roster import from the association's spreadsheet. Safe to run more than once:
-- teams, players and people are matched by name/email and updated in place.
--
-- p_rows: [{ "team": "12U Red", "jersey": "12", "first_name": "Emma", "last_name": "Johnson",
--            "parents": [{ "name": "Pat One", "email": "pat@example.com" }],
--            "coaches": [{ "name": "Coach Carter", "email": "coach@example.com" }] }]
create or replace function public.import_roster(p_season uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  c jsonb;
  v_team uuid;
  v_player uuid;
  v_person uuid;
  v_teams int := 0;
  v_players int := 0;
  v_people int := 0;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Only admins can import rosters' using errcode = '42501';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(trim(r->>'team'), '') = '' or coalesce(trim(r->>'first_name'), '') = '' then
      continue;
    end if;

    select id into v_team from public.teams
      where season_id = p_season and lower(name) = lower(trim(r->>'team'));
    if v_team is null then
      insert into public.teams (season_id, name) values (p_season, trim(r->>'team')) returning id into v_team;
      v_teams := v_teams + 1;
    end if;

    select id into v_player from public.players
      where team_id = v_team
        and lower(first_name) = lower(trim(r->>'first_name'))
        and lower(last_name) = lower(coalesce(trim(r->>'last_name'), ''));
    if v_player is null then
      insert into public.players (team_id, first_name, last_name, jersey_number)
        values (v_team, trim(r->>'first_name'), coalesce(trim(r->>'last_name'), ''), coalesce(trim(r->>'jersey'), ''))
        returning id into v_player;
      v_players := v_players + 1;
    else
      update public.players set jersey_number = coalesce(nullif(trim(r->>'jersey'), ''), jersey_number), active = true
        where id = v_player;
    end if;

    for c in select * from jsonb_array_elements(coalesce(r->'parents', '[]'::jsonb)) loop
      v_email := lower(trim(c->>'email'));
      continue when coalesce(v_email, '') = '';
      select id into v_person from public.people where lower(email) = v_email;
      if v_person is null then
        insert into public.people (email, name) values (v_email, coalesce(trim(c->>'name'), ''))
          returning id into v_person;
        v_people := v_people + 1;
      elsif coalesce(trim(c->>'name'), '') <> '' then
        update public.people set name = trim(c->>'name') where id = v_person and name = '';
      end if;
      insert into public.guardians (player_id, person_id) values (v_player, v_person) on conflict do nothing;
    end loop;

    for c in select * from jsonb_array_elements(coalesce(r->'coaches', '[]'::jsonb)) loop
      v_email := lower(trim(c->>'email'));
      continue when coalesce(v_email, '') = '';
      select id into v_person from public.people where lower(email) = v_email;
      if v_person is null then
        insert into public.people (email, name) values (v_email, coalesce(trim(c->>'name'), ''))
          returning id into v_person;
        v_people := v_people + 1;
      end if;
      insert into public.team_staff (team_id, person_id) values (v_team, v_person) on conflict do nothing;
    end loop;
  end loop;

  -- Link anyone who already has a login.
  update public.people p set auth_user_id = u.id
  from auth.users u
  where p.auth_user_id is null and lower(u.email) = lower(p.email);

  return jsonb_build_object('teams', v_teams, 'players', v_players, 'people', v_people);
end;
$$;

revoke execute on function public.import_roster(uuid, jsonb) from public, anon;
grant execute on function public.import_roster(uuid, jsonb) to authenticated;

-- Links the signed-in user to a roster entry with the same email, when a coach or
-- admin was added after that person first logged in.
create or replace function public.link_me()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.people set auth_user_id = auth.uid()
  where auth_user_id is null
    and lower(email) = (select lower(u.email) from auth.users u where u.id = auth.uid());
  return found;
end;
$$;
revoke execute on function public.link_me() from public, anon;
grant execute on function public.link_me() to authenticated;
