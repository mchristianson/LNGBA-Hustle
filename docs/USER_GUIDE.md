# LNGBA Hustle Tracker: How It Works

Two roles matter day to day: **Admin** (Angie, Matt) sets everything up, and **Parent scorer** taps buttons at games. Everyone else on the roster just watches.

There are no passwords. People log in with the email the association has on file.

---

## Part 1: Admin guide (Angie)

### A. First login

1. Matt adds your email as an admin (Admin page → **Admins** → Name + Email → **Add admin**).
2. Go to the app's login page, type your email, tap **Email me a login link**.
3. Open the email and tap the link, or type the 6-digit code on the login page. Check spam if it does not show up.
4. You now see an **Admin** link in the top bar. Tap it.

### B. Set up each team

Admin → tap a team.

1. **Team scorer:** pick the parent who will normally run the app at games and tap **Save**. That parent can take over scoring any game if someone else grabbed it.
2. **Coaches:** add name + email under **Coaches** if the import did not include them. Coaches can add games and watch live, but cannot score.
3. **Check the roster:** each player shows their parents with a status: *Not invited*, *Invited (date)*, *Logged in*, or *Said "not me"*.

### C. Invite parents

Pick whichever fits:

- **Email everyone:** the red **Email N not yet invited** button on the team page sends every uninvited parent and coach an email. It stops if the daily email limit is hit; tap again the next day.
- **Email one person:** **Email invite** next to their name.
- **Text a link:** **Copy link** next to their name, then paste into a text. Use this if email is not set up or a parent never sees emails.

Notes:
- A new link replaces any older unused link for that person.
- Parents see an "Is this you?" page with their name, masked email, and their player. **Yes, that's me** logs them in. **No, this is not me** flags the row *Said "not me"* on your screen so you can fix the email.
- Links last until the season end date.

### D. Add games (before or during the season)

Admins, coaches, and parents on the team can add games with the team page **Add game** button. Only admins and coaches can edit or delete a game.

1. Teams → pick team → **Add game**.
2. Fill in tournament/event (stays filled for the next game), opponent, date and time, location.
3. **Save**, or **Save + add another** to enter a whole tournament in a row.
4. Games show under **Upcoming** until 3 hours after start, then move to **Results** with the top 3 hustle players.

### E. During the season

- **Watch adoption:** Admin page shows parents logged in per team. Resend invites to stragglers.
- **Unstick a game:** open the game. If a scorer left or their phone died, tap **Take over scoring** (you can always take over) or **Clear the current scorer** so another parent can claim it.
- **Fix mistakes:** scorers can undo their own taps for 24 hours. After that, edit rows in the Supabase table editor (`hustle_events`) (I will do that if needed).
- **Roster changes:** edit the CSV and re-import, or add coaches/admins in the app.
- **See results:** team page → **Leaderboard** (total points and points per game); **Hustle Board** in the top bar (top 3 for every team).

Not built yet: top-hustle photo upload and CSV export.

---

## Part 2: Parent scorer guide

### A. Get in

1. You get an email or text from the association with a link. Tap it.
2. Check the name and player on the "Is this you?" screen, then tap **Yes, that's me**.
3. Later, log in again anytime with your email at the login page (link or 6-digit code). Add the site to your phone's home screen for one-tap access.

If the link says it expired, use **Log in with email** instead.

### B. Before the game

1. Home → your team → find the game under **Upcoming**.
2. Charge your phone. The screen stays awake while you score.

### C. Start scoring

1. Open the game. Tap **I'm scoring this game**.
2. Only one parent scores per game. If someone else already started, you see their name and the totals update live. The team scorer or an admin can take over if needed.

### D. Scoring plays

Each player has a card with big labeled buttons and their running score:

| Button | Points |
|---|---|
| Rebound | +1 |
| Steal | +1 |
| Block | +1 |
| Deflection | +1 |
| Charge | +3 |
| Assist | +2 |
| Turnover | −2 |

1. A reminder of these values is at the top of the screen.
2. Tap the button right when the play happens. The phone buzzes and the player's score jumps.
3. Wrong tap? Tap **Undo** on that player's card. It removes their most recent tap.
4. The top of the screen says **All saved** when everything has uploaded.

### E. Bad signal in the gym

1. Keep tapping. The screen says **Offline · N saved on this phone**.
2. When signal returns, taps upload on their own, once each (no double counting).
3. Do not clear your browser data or close the app until it says **All saved**.

### F. When you are done

1. Wait for **All saved**.
2. Tap **Stop scoring (let another parent take over)** if someone else will score the next game.
3. The game moves to **Results** with the top 3 hustle players. Everyone can see the **Leaderboard** and **Hustle Board**.

If you see "N taps could not be saved because you are no longer the scorer," an admin or team scorer took over. Tell them what was missed.

### G. If you are not scoring

Open the game any time to see live totals for each player. Read-only, no buttons.

---

## Quick troubleshooting

| Problem | Fix |
|---|---|
| "I never got the email" | Check spam. Admin copies the link and texts it. Confirm the email on the roster matches. |
| Login says sent, nothing arrives | Email must be on the roster. Admin checks the spelling. |
| Someone else grabbed scoring | Team scorer or admin taps **Take over scoring**. |
| Scorer's phone died | Admin taps **Clear the current scorer**, another parent claims it. |
| Wrong player got points | Scorer taps Undo on that player (within 24 hours). |
| Parent says "not me" | Fix the email on the roster and re-import, then resend the invite. |
