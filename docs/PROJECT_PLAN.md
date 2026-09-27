# LNGBA Hustle Tracker: Project Plan

Mobile-first web app for Lakeville North Girls Basketball Association (LNGBA) travel teams. Parents and coaches log hustle plays during games. The app keeps a running team leaderboard for the season-end hustle trophy.

## 1. Goals

1. Replace the paper sheet and the shared Google spreadsheet.
2. Passwordless login: magic links only.
3. One-tap scoring on a phone, courtside.
4. Live team leaderboard per game and per season.
5. Coach photo of the game's top hustle player, saved for social media.

## 2. Scoring rules (from the paper tracker)

| Action | Code | Points |
|---|---|---|
| Rebound | R | +1 |
| Steal | S | +1 |
| Block | B | +1 |
| Deflection | D | +1 |
| Charge | C | +3 |
| Assist | A | +2 |
| Turnover | T | -2 |

Store these in a `hustle_actions` table, not in code. The board then changes point values without a deploy.

## 3. Users and roles

| Role | How they get in | What they do |
|---|---|---|
| Admin (association) | Magic link | Manage seasons, teams, rosters, coaches. Import CSV. Export results. |
| Coach | Magic link from invite | Add and edit games, view summaries and leaderboards, upload top-hustle photo. No scoring. |
| Parent | Magic link from invite | Confirm identity, view schedule and leaderboard. The game scorer (one parent per game) enters points. |

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + React + Tailwind | Server components, Vercel native, fast on phones |
| Hosting | Vercel | Zero-config deploys, preview URLs per branch |
| Database | Supabase Postgres | Row Level Security (RLS) enforces who sees what at the database level |
| Auth | Supabase Auth, email OTP / magic link | No passwords |
| Email | Resend (custom SMTP for Supabase) + React Email templates | Supabase's built-in email is rate limited to a few emails per hour and is not meant for production |
| Files | Supabase Storage (private bucket, signed URLs) | Player photos of minors stay private |
| Offline | PWA + IndexedDB queue | Gym Wi-Fi and cell signal are often poor |

## 5. Login flow

### 5a. Invite link ("Is this you?")

Supabase magic links expire in at most 24 hours and work once. Email security scanners (Outlook Safe Links, school Gmail filters) often "click" links before the parent does and burn them. So the invite uses our own token:

1. Admin imports roster. System creates an `invites` row per email: random 32-byte token, stored as a SHA-256 hash, linked to player(s) and role, expires end of season.
2. Email: "Tap to start tracking hustle points for Emma #12."
3. Link opens `/join/[token]`. Page shows: "Is this you? Parent of Emma Johnson, #12, 14U Red. Email: j***@gmail.com." Buttons: **Yes, that's me** / **Not me**.
4. Page load does nothing. Only the **Yes** button (a POST) signs the user in. Scanners never press the button, so the link survives.
5. On **Yes**: server action uses the Supabase admin API (`generateLink` + `verifyOtp`) to create the session, links `auth.users.id` to the player through `guardians`, and marks the invite accepted.
6. **Not me**: flags the invite for admin review.

### 5b. Returning user or no email in hand

1. Parent goes to the site and enters an email.
2. If the email exists in `people`, Supabase sends a magic link or 6-digit code. Offer both: a code works when the email opens in a different browser than the home screen app.
3. Same response whether or not the email exists ("If this email is on a roster, a link is on its way.") so nobody can probe for player emails.

### 5c. Sessions

Long sessions (refresh token rotation, 30+ days) so parents stay logged in all season. "Add to Home Screen" prompt after first login.

## 6. Data model (Postgres)

```
seasons        (id, name, starts_on, ends_on, is_active)
teams          (id, season_id, name, level, age_group)
players        (id, team_id, first_name, last_name, jersey_number, active)
people         (id, email unique, name, auth_user_id null)   -- anyone on a roster
team_staff     (team_id, person_id, role: 'head_coach' | 'assistant')
guardians      (player_id, person_id, relationship)
invites        (id, token_hash, person_id, expires_at, accepted_at, flagged)
admins         (person_id)
tournaments    (id, team_id, name, location, starts_on, ends_on)
games          (id, team_id, tournament_id null, opponent, starts_at, location, status)
hustle_actions (code, label, points, sort_order)
hustle_events  (id uuid, game_id, player_id, action_code, points, recorded_by,
                client_created_at, created_at, voided_at null)
game_photos    (id, game_id, player_id, storage_path, uploaded_by, consent_ok)
```

Key decisions:

1. **Event log, not counters.** Each tap inserts one `hustle_events` row. Undo sets `voided_at`. Totals come from `SUM(points)`. This gives an audit trail and makes offline sync safe.
2. **Client-generated UUIDs** on events. A retried offline upload inserts once (`ON CONFLICT DO NOTHING`).
3. **`points` copied onto each event** so a mid-season rule change does not rewrite history.
4. **Views** `v_game_player_totals` and `v_season_leaderboard` feed the leaderboard pages.

## 7. Security (RLS)

1. Parents read and write only their own team's games and events.
2. Coaches read their team and write games and photos. Coaches do not write events.
3. Only the current scorer of a game inserts events for it. Scorers void only their own events, and only within the game day. Admins fix anything after that.
4. Admins read and write everything.
5. Photo bucket private. Signed URLs expire in 1 hour. Only coaches and admins upload.
6. Rate limit the "send me a link" form (Vercel middleware or Upstash) to stop email abuse.

## 8. Screens (mobile-first)

**Parent / Coach**
1. `/join/[token]`: Is this you?
2. `/login`: email entry, code entry.
3. `/`: schedule. Upcoming games on top, past games below with the top 3 hustle players.
4. `/games/[id]/score`: the scoring screen (see below).
5. `/games/[id]`: game summary, per-player breakdown, photo.
6. `/leaderboard`: season totals for the team, with per-action breakdown.

**Coach only**
7. `/games/new`: quick add (opponent, date/time, location, tournament). "Add another" keeps the tournament filled in.
8. Photo upload on the game summary.

**Admin**
9. Seasons, teams, roster CSV import, resend invites, CSV export of all results.

### Scoring screen layout

One card per player, sorted by jersey number:

```
#12 Emma J.                     Total: 9
[R +1] [S +1] [B +1] [D +1]
[C +3] [A +2] [T -2]      [Undo]
```

1. Buttons at least 48px tall (Apple and Google touch-target guidance is 44 to 48px).
2. Haptic buzz (`navigator.vibrate`) and a short flash on each tap.
3. Per-player "Undo last" for mis-taps.
4. Turnover button in a different color so it is hard to hit by mistake.
5. Screen Wake Lock API keeps the phone from sleeping mid-game.
6. Optional compact mode: tap a player, then an action, for rosters over 10.
7. Sync badge: "All saved" or "3 waiting to upload".

## 9. Client decisions (Angie, Sep 2026)

| # | Question | Answer | What we build |
|---|---|---|---|
| 1 | Who enters points | One scorer per game | Scorer lock per game. Other parents see live totals, read only. |
| 2 | How the scorer is picked | Each team decides. Each team names one parent to run it. | Each team has a default "team scorer." Any parent on the team can tap "I'm scoring this game" when the team scorer is absent. The current scorer or an admin hands it off. |
| 3 | Coaches scoring | Coaches do not score | Coaches add games, view results, upload photos. No scoring buttons. Admin fixes mistakes after the game day. |
| 4 | Trophy winner | Show both, coach decides | Leaderboard shows total points and points per game side by side. |
| 5 | Who parents see | Own team, full detail. Plus a view of every team's top 3. | Team leaderboard: full, own team only. "Hustle Board": top 3 per team, all 15 teams, first name + last initial. Edit rights stay on own team. |
| 6a | Photos | Releases expected to be in place. Angie confirms at the parent meeting. | Build photo upload. Keep photos visible to coaches and admins only until confirmed. |
| 6b | Admin | Angie runs it. She has a spreadsheet with all parent emails. | Angie is the first admin. Build CSV import to match her spreadsheet columns. |
| - | Launch date | First tournament Nov 7-8, 2026. Wants a test at 3v3 (3 weeks left). | Revised schedule below. |

Still open:

1. Dates and times of the remaining 3v3 sessions, and which teams play.
2. A copy (or just the column headers) of Angie's roster spreadsheet.
3. Photo release confirmation after the parent meeting.
4. Custom domain, for example `hustle.lakevillenorthgba.org`.

## 10. Build phases and estimate

| Phase | Work | Hours |
|---|---|---|
| 0. Setup | Repo, Next.js, Supabase project, Vercel, Resend, CI, envs | 6 |
| 1. Data + security | Schema, migrations, RLS policies, seed data, RLS tests | 14 |
| 2. Auth | Invite tokens, Is-this-you page, OTP login, email templates | 16 |
| 3. Admin | Seasons, teams, roster CSV import, send and resend invites | 12 |
| 4. Schedule | Game list, coach quick-add, edit, tournaments | 10 |
| 5. Scoring | Scoring screen, undo, team scorer + scorer lock, realtime totals, offline queue | 22 |
| 6. Results | Game summary, team leaderboard (total + per game), all-teams top 3 board, CSV export | 10 |
| 7. Photos | Camera capture, client-side resize, private storage | 8 |
| 8. PWA + polish | Manifest, icons, wake lock, add-to-home-screen, accessibility | 8 |
| 9. QA + launch | Device testing (iOS Safari, Android Chrome), 3v3 tests, docs | 12 |
| **Total** | | **~118 hours** |

## 11. Schedule to hit Nov 7

The original plan (6 weeks build + 2 weeks pilot) ends in late November. That misses the first tournament. The revised plan ships a small test version in 2 weeks and grows it during the 3v3 sessions.

| Dates (2026) | Goal | Scope | Hours |
|---|---|---|---|
| Sep 28 - Oct 10 | **3v3 test version** | Phases 0-3, scoring screen with scorer lock and undo, team leaderboard. Admin enters games. No offline, no photos. | ~60 |
| Oct 10 - Oct 18 | **3v3 tests** (last 2 sessions) | Fix what parents report. Add offline queue. | ~15 |
| Oct 19 - Nov 1 | **Full feature set** | Coach game entry, all-teams top 3 board, points per game, photos, CSV export, PWA polish | ~35 |
| Nov 2 - Nov 4 | **Invites out** | Import all 15 rosters. Send invites. Help parents who get stuck. Code freeze Nov 4. | ~8 |
| Nov 7 - 8 | **First tournament live** | Watch errors live. Hotfix only. | - |

Pace: about 30 hours/week for the first 2 weeks, then about 17 hours/week.

Email volume: about 330 invites (15 teams x ~20 parents + coaches). Resend's free plan allows 100 emails/day, so invites take 4 days. Either send in batches starting Nov 2, or use Resend Pro ($20/month, 50,000 emails/month) for November.

If time runs short, cut in this order: photos, CSV export, all-teams top 3 board. Scoring, login and the team leaderboard stay.

## 12. Running costs (per month, approximate)

| Service | Plan | Cost | Notes |
|---|---|---|---|
| Supabase | Free, or Pro | $0 or $25 | Free projects pause after 7 days with no activity. Use Pro during the season. |
| Vercel | Hobby, or Pro | $0 or $20 | Hobby terms cover non-commercial use only. Put the project under the association's own account. |
| Resend | Free | $0 | 3,000 emails/month, 100/day. About 300 parents and 30 coaches fit easily. Stagger invite sends over days. |
| Domain | Subdomain of existing site | $0 | DNS record on the LNGBA domain |

Estimated scale: 15 teams x 10 players x 30 games x 15 events = about 70,000 event rows per season. Well inside the Supabase free tier's 500 MB.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Emails land in spam | Resend with SPF, DKIM, DMARC on the LNGBA domain. Send from a real address. |
| Poor gym signal | Offline queue, sync badge |
| Double counting | Single scorer per game (section 9) |
| Tight timeline for Nov 7 | Ship a test version for 3v3 first. Cut photos, CSV export, all-teams board before scoring or login. |
| Minor privacy | RLS, private photos, no public pages, first name + last initial in lists |
| Parent confusion | Is-this-you step, code fallback, one-page help card handed out at the first tournament |

## 14. Future ideas

1. Auto-generated social media graphic (player photo + stats) with `@vercel/og`.
2. Season-end award page for the board, sorted by team.
3. Import tournament schedules from the association website.
4. Per-quarter tracking and trends per player.
