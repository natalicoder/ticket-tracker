# Demo script (3 minutes)

## Before the demo

1. Reset and start the stack, then open three browser tabs:
   ```sh
   docker compose down -v
   docker compose up --build
   ```
   - App: http://localhost:8080
   - Your mailbox (Outlook): verification emails arrive through relay1.dataart.com, so be in the office network or on VPN
   - API docs: http://localhost:8080/api/docs (log in to the app first)
2. Prepare a populated board for part 4. This creates its own account; the script prints the login:
   ```sh
   docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm e2e \
     sh -c "SEED_OUT=/tmp/seed.json npx tsx scripts/seed-300.ts"
   ```
3. Use a browser width of at least 1280 px so all five columns fit.

## 0:00 – 0:20 · What it is

"A Kanban ticket tracker: React SPA, Fastify API, PostgreSQL, all started with one `docker compose up --build`. The database starts empty and the DB password is generated at first start, so there are no secrets in the repo."

## 0:20 – 0:55 · Sign up and verify (requirement 3)

1. Choose **Create an account**. Enter an email with capitals and surrounding spaces, plus an 8-character password.
2. The check-your-email screen appears. Try **Log in** right away: it is refused with "Verify your email first".
3. Switch to your mailbox, open "Verify your email for Ticketing" and click the link. The page says **Email verified** → **Go to login**.
4. Log in. "The email was trimmed and lower-cased; tokens are single-use, expire after 24 hours, and a resend invalidates older ones."

## 0:55 – 1:35 · Team, epic, ticket (requirements 4–6)

1. Onboarding: create the team **Payments**.
2. **Add an epic** → **Checkout**. "Epics live on their own screen and belong to one team for good."
3. Back on the board, use the quick add at the bottom of **In progress**: type `bug: Card declined @check` and press Enter. "Type, epic and column are filled in for me." Add a checklist body:
   ```
   - [ ] reproduce
   - [ ] fix
   ```
   Then choose **Create ticket**.
4. Start another ticket titled "Card declined". The duplicate hint appears: "pg_trgm finds similar titles."

## 1:35 – 2:15 · The board (requirement 8)

1. Drag the card to **Ready for acceptance**. The toast says "Moved #N…". **Reload**: the card stays where it was dropped.
2. Click **Undo**. "Every drop is a PATCH; if the server refuses, the card goes back and the error shows."
3. Keyboard: press `j` to focus a card, then `Shift+→` to move it. Press `?` to show all shortcuts.
4. Open the seeded 300-ticket board (team switcher, or `Ctrl+K` → team name). Type `invoice` in search and pick **Bug** in the type filter. "AND-combined, case-insensitive, kept in the URL; columns virtualize, first card in about 0.4 s."

## 2:15 – 2:45 · Ticket details and comments (requirements 6–7)

1. Open a ticket. Show **Created by**, **Created** and **Modified** in UTC.
2. Tick a checklist item in the preview; it saves on its own.
3. Add a comment. The author and the time appear. "A comment does not touch Modified, so the board order stays."
4. Change the team. The epic clears: "epics belong to a team; the backend rejects a mismatch too."
5. Open the **Activity** tab: one entry per changed field.

## 2:45 – 3:00 · Guard rails and quality

1. On **Teams**, the delete button for Payments is disabled. Click it: a message says "Team has 1 ticket and 1 epic…". "The API answers 409 for the same case."
2. Close with: "233 unit and integration tests, 12 Playwright end-to-end tests with axe accessibility checks in light and dark, and CI on every push. The README maps every requirement to its code and its test."

## If something goes wrong

- **No email arrives:** check the VPN connection and the junk folder, then run `docker compose logs api` and look for `failed to send email`. Use **Resend verification email** on the login page. Without the DataArt network, switch to the Mailpit mode from the README ("Email delivery").
- **Port 8080 is busy:** start with `WEB_PORT=8081 docker compose up --build`.
- **You need a clean slate:** run `docker compose down -v`.
