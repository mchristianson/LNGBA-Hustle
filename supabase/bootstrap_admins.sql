-- Run once in the Supabase SQL editor after the migrations.
-- Creates the first season and makes Matt and Angie admins. Edit Angie's email first.
insert into public.seasons (name, starts_on, ends_on, is_active)
select '2026-27', '2026-10-01', '2027-03-31', true
where not exists (select 1 from public.seasons where is_active);

insert into public.people (email, name) values
  ('christianson.matt@gmail.com', 'Matt Christianson'),
  ('angie@replace-me.com', 'Angie')
on conflict ((lower(email))) do nothing;

insert into public.admins (person_id)
select id from public.people
where lower(email) in ('christianson.matt@gmail.com', 'angie@replace-me.com')
on conflict do nothing;
