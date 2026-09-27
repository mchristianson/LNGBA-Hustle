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
| Coach | Magic link from invite | Add and edit games, score players, view summaries, upload top-hustle photo. |
| Parent | Magic link from invite | Confirm identity, view schedule, score players, view leaderboard. |

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
2. Coaches read and write their team. Coaches edit or void any event on their team.
3. Parents void only events they recorded, and only within the game day.
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

## 9. Open question: who is the official scorer?

The client says one parent fills out the sheet per game. The request says every parent scores. If three parents tap the same rebound, that player gets 3 points.

Options:

| Option | How it works | Trade-off |
|---|---|---|
| A. One scorer per game (recommended) | First parent to tap "I'm scoring this game" locks it. Coach can reassign. Others watch live totals. | Matches today's process. Clean data. |
| B. Anyone scores, coach picks official | Each recorder's tally saved separately. Coach marks one as official after the game. | More work for coaches. |
| C. Anyone scores, all counts added | Simplest code. | Inflated, unfair totals. Not recommended. |

Confirm with the client before building the scoring screen.

## 10. Other questions for the client

1. Should parents see other teams' leaderboards, or only their own?
2. Are all 15 teams in one season, and do players ever play on two teams?
3. Do you have a photo release on file for every player? Can we show photos only to coaches and admins?
4. Who is the admin? One person or a few board members?
5. Do you want the season award based on total points, or points per game (fair to players who miss games)?
6. Does a roster spreadsheet exist today (player, jersey, team, parent emails)?
7. Custom domain, for example `hustle.lakevillenorthgba.org`?

## 11. Build phases and estimate

| Phase | Work | Hours |
|---|---|---|
| 0. Setup | Repo, Next.js, Supabase project, Vercel, Resend, CI, envs | 6 |
| 1. Data + security | Schema, migrations, RLS policies, seed data, RLS tests | 14 |
| 2. Auth | Invite tokens, Is-this-you page, OTP login, email templates | 16 |
| 3. Admin | Seasons, teams, roster CSV import, send and resend invites | 12 |
| 4. Schedule | Game list, coach quick-add, edit, tournaments | 10 |
| 5. Scoring | Scoring screen, undo, scorer lock, realtime totals, offline queue | 22 |
| 6. Results | Game summary, season leaderboard, CSV export | 8 |
| 7. Photos | Camera capture, client-side resize, private storage | 8 |
| 8. PWA + polish | Manifest, icons, wake lock, add-to-home-screen, accessibility | 8 |
| 9. QA + launch | Device testing (iOS Safari, Android Chrome), pilot with 1 to 2 teams, docs | 12 |
| **Total** | | **~116 hours** |

Plan for a 6-week build part time, then a 2-week pilot with two teams before the full 15-team rollout.

MVP cut (about 70 hours): phases 0 to 6 without offline, CSV import, or photos. Add those in a second release.

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
| Minor privacy | RLS, private photos, no public pages, first name + last initial in lists |
| Parent confusion | Is-this-you step, code fallback, one-page help card handed out at the first tournament |

## 14. Future ideas

1. Auto-generated social media graphic (player photo + stats) with `@vercel/og`.
2. Season-end award page for the board, sorted by team.
3. Import tournament schedules from the association website.
4. Per-quarter tracking and trends per player.
