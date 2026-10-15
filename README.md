# LNGBA Hustle Tracker

Mobile web app for Lakeville North Girls Basketball Association travel teams. One parent per game taps a button for each hustle play. Everyone on the team sees live totals, a season leaderboard, and a Hustle Board with every team's top 3.

Stack: Next.js 16 (App Router) on Vercel, Supabase (Postgres, Auth, Realtime), Resend for invite email.

See `docs/PROJECT_PLAN.md` for the full plan and client decisions.

## What works now

| Area | Status |
|---|---|
| Invite links with "Is this you?" confirm | Built |
| Email login with link or 6-digit code (no passwords) | Built |
| Roster CSV import (teams, players, parents, coaches) | Built |
| Admin: roster, invite status, copy link or email invite, team scorer, coaches, admins | Built |
| Schedule, "Add game" with "Save + add another" | Built |
| Scoring screen: one scorer per game, undo, big buttons, screen stays awake | Built |
| Offline: taps saved on the phone and uploaded when signal returns | Built |
| Live totals for other parents (Supabase Realtime) | Built |
| Team leaderboard: total points and points per game | Built |
| Hustle Board: top 3 per team, all teams | Built |
| Top-hustle photo upload, CSV export | Next phase |

## Setup

### 1. Database

Apply the files in `supabase/migrations/` in order. Either:

- Supabase dashboard → SQL Editor → paste each file and run, or
- `npx supabase link --project-ref gitoamerbmxkzynmlqji && npx supabase db push`

Then put Angie's real email into `supabase/bootstrap_admins.sql` and run it. It creates the 2026-27 season and makes Matt and Angie admins.

### 2. Supabase Auth settings

**Authentication → URL Configuration**
- Site URL: the production URL, for example `https://hustle.lakevillenorthgba.org`
- Redirect URLs: add `http://localhost:3000/**` and the Vercel preview pattern

**Authentication → Email Templates → Magic Link.** Replace the body with:

```html
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f4;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dedad8;">
      <tr><td style="background:#d7191f;padding:20px 28px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:0.04em;color:#ffffff;text-transform:uppercase;">
        LNGBA Hustle
      </td></tr>
      <tr><td style="padding:32px 28px 8px;font-family:'Source Sans 3',-apple-system,'Segoe UI',Arial,sans-serif;color:#17171a;">
        <h1 style="margin:0 0 12px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:30px;font-weight:800;line-height:1.05;text-transform:uppercase;color:#17171a;">Your login is ready</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#5d5a5c;">Tap the button to sign in to Hustle Tracker.</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#d7191f;">
          <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" style="display:inline-block;padding:14px 28px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#ffffff;text-decoration:none;">Log in to Hustle Tracker</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:24px 28px 32px;font-family:'Source Sans 3',-apple-system,'Segoe UI',Arial,sans-serif;">
        <p style="margin:0 0 8px;font-size:14px;color:#5d5a5c;">Or type this code in the app:</p>
        <div style="display:inline-block;padding:10px 18px;background:#fbe7e7;border-radius:8px;font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-size:32px;font-weight:800;letter-spacing:0.18em;color:#a8141a;">{{ .Token }}</div>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #dedad8;font-family:'Source Sans 3',-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;line-height:1.5;color:#5d5a5c;">
        Didn't ask for this? You can ignore this email.
      </td></tr>
    </table>
  </td></tr>
</table>
```

**Authentication → Sign In / Providers → Email:** turn off "Allow new users to sign up". The app creates logins itself, and only for roster emails.

**Authentication → SMTP Settings:** use Resend (host `smtp.resend.com`, port 465, user `resend`, password = Resend API key). Supabase's built-in email only sends a few messages per hour.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in `SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret key). Add the same variables in Vercel.

`RESEND_API_KEY` and `EMAIL_FROM` are optional at first. Without them, admins tap **Copy link** and text invite links to parents.

### 4. Run

```bash
npm install
npm run dev
```

## Tests

The database security rules have a test script. It runs against any local Postgres 15+ with a stand-in for Supabase's auth schema:

```bash
PGHOST=/tmp PGPORT=55432 PGUSER=postgres npm run test:db
```

30 checks, including: parents see only their own team, parents can add (not edit or delete) their own team's games, only the current scorer records taps, the server sets the points, undo works only on your own taps, coaches cannot score, and roster import is admin-only and safe to run twice.

## How scoring works

1. On the admin team page, pick a **team scorer** (the parent who runs the app for that team).
2. At a game, the first parent to tap **I'm scoring this game** becomes the scorer. The team scorer and admins can **Take over scoring** at any time.
3. Each tap is saved as its own row with an id made on the phone, so a retry after a dropped connection never double counts.
4. Undo marks the last tap as voided. Scorers undo their own taps for 24 hours. Admins fix anything later in the Supabase table editor.

## Roster CSV format

One row per player. Headers are matched loosely (case, spaces and `#` ignored):

```
Team,Jersey,Player First Name,Player Last Name,Parent 1 Name,Parent 1 Email,Parent 2 Name,Parent 2 Email,Coach Name,Coach Email
12U Red,12,Emma,Johnson,Pat Johnson,pat@example.com,Sam Johnson,sam@example.com,Coach Carter,coach@example.com
```

A single "Player Name" column also works. Any other column with "email" in its name (for example "Player Email") is treated as a family contact and gets an invite.
