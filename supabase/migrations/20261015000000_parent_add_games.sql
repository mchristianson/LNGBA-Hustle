-- Parents add games to their own team. Editing and deleting stay with coaches and admins.
create policy parent_insert on public.games for insert to authenticated
  with check (public.is_team_parent(team_id) and scorer_id is null);
