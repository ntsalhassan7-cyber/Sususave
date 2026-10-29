# Sususave

A web app for running a susu (rotating savings group). The admin sets the group up and tracks
money; each member sees their turn, the schedule and their payments. Cash handed over in person
is recorded in the app, and with a Paystack account members can pay by mobile money and the
admin can send the pot to the collector's MoMo wallet.

- One link, three apps: the login door, the admin app (`#admin`) and the member app (`#home`).
- Real accounts: an admin account per group, a 6-character join code, member accounts inside the group.
- Payments: cash marked by the admin or the round's collector; MoMo pay-in by the member (Paystack);
  MoMo payout to the collector by the admin (Paystack transfers).
- Database: libSQL (SQLite). A local file when you run it on your computer; a free Turso database when hosted.

## Run it on your computer

```
npm install
cp .env.example .env     # optional: fill in keys
npm start                # http://localhost:3000
npm test                 # API checks + a full browser run (needs Playwright's Chromium)
```

With nothing in `.env`, the app runs in cash-only mode and keeps its data in `data/susu.db`.

## Host it on Vercel

Vercel has no disk, so the database must live somewhere else. Turso is free and uses the same SQL.

1. **Database (Turso).** Sign up at https://turso.tech, create a database, and copy its URL
   (`libsql://...`) and an auth token.
2. **Vercel.** At https://vercel.com, "Add New Project", import the `Sususave` GitHub repository.
   Leave the build settings as they are (no build step).
3. **Environment variables** (Project > Settings > Environment Variables), then redeploy:

   | Name | Value |
   | --- | --- |
   | `SESSION_SECRET` | any long random text, for example the output of `openssl rand -hex 32` |
   | `TURSO_DATABASE_URL` | the Turso URL |
   | `TURSO_AUTH_TOKEN` | the Turso token |
   | `BASE_URL` | your site address, for example `https://sususave.vercel.app` |

4. Open the site, choose **Admin**, then **Starting a new group? Create the admin account**.
   Fill in the Group page and save. The People page shows the join code to send to members.

## Turning on mobile money (Paystack)

To try it on your computer: copy `.env.example` to `.env`, put your **test** secret key in
`PAYSTACK_SECRET_KEY=sk_test_...`, restart `npm start`. Members then see "Pay by MoMo"; on
Paystack's test page use the test mobile money numbers from Paystack's docs (for example
MTN 0551234987 with OTP 123456 for a successful payment). Nothing real is charged with test keys.


1. Create a Paystack business at https://paystack.com (Ghana) and get your keys from
   Settings > API Keys & Webhooks. Test keys work with Paystack's test MoMo numbers.
2. Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` to the Vercel environment variables and redeploy.
3. In Paystack, set the webhook URL to `https://<your site>/api/paystack/webhook`.
4. For payouts to collectors, Paystack must enable transfers on your business and your balance
   must hold the money. Members add their MoMo number on the Payments page of the member app.

What members and the admin then see:

- A member who still owes a round gets a **Pay by MoMo** button. They confirm on their phone and the
  payment shows as "Paid by MoMo" once Paystack confirms it (callback and webhook).
- The admin gets **Send ... by MoMo** next to the cash option for a round's collector.
- MoMo records cannot be unmarked by hand; cash records can.

## Project layout

```
api/index.js          Vercel entry (wraps the Express app)
src/server.js         the API: accounts, settings, cash, MoMo, webhook
src/db.js             libSQL connection and tables
src/paystack.js       Paystack calls
public/index.html     the one page that holds all three apps
public/shared/        logic.js (schedule maths, shared with the server), core.js (data + helpers), base.css
public/login/         login door: member sign-in, join wizard, admin sign-in, create a group
public/admin/         admin app
public/user/          member app
test/api.js           API checks
test/e2e.js           browser run with Playwright
```

## API in short

| Call | Who | What |
| --- | --- | --- |
| `POST /api/admin/signup` | anyone | new group + admin account |
| `POST /api/admin/login`, `POST /api/member/login`, `POST /api/logout` | anyone | sessions (cookie) |
| `GET /api/group/:code` | anyone | group name and whether it is open |
| `POST /api/member/signup` | anyone with the code | join a group |
| `GET /api/state` | signed in | everything the apps render |
| `PUT /api/settings`, `POST /api/settings/open`, `DELETE /api/members/:id`, `POST /api/members/:id/password` | admin | run the group |
| `PUT /api/me`, `PUT /api/me/password` | member | MoMo number, password |
| `POST /api/payments/cash`, `POST /api/payments/all`, `POST /api/payouts/cash` | admin or the round's collector | record cash |
| `POST /api/payments/momo/start`, `GET /api/payments/momo/status` | member | pay by MoMo |
| `POST /api/payouts/momo` | admin | send the pot by MoMo |
| `POST /api/paystack/webhook` | Paystack | confirmations |
