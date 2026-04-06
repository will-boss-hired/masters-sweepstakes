# The Masters 2026 Sweepstakes

A full-stack sweepstakes web app for your Masters tournament group.

---

## What you'll need

- A free [Supabase](https://supabase.com) account (the database)
- A free [Vercel](https://vercel.com) account (the hosting)
- A free [GitHub](https://github.com) account (to connect the two)
- [Node.js](https://nodejs.org) installed on your computer (v18 or above)

---

## Step 1 — Set up Supabase (the database)

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New project**. Give it a name (e.g. `masters-2026`). Set a database password and save it somewhere safe.
3. Wait for the project to be ready (~1 minute).
4. In the left sidebar, click **SQL Editor**.
5. Copy the entire contents of `supabase-schema.sql` (in this project folder) and paste it into the SQL editor.
6. Click **Run**. You should see "Success" messages.
7. In the left sidebar, go to **Project Settings → API**.
8. Copy these two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdef.supabase.co`)
   - **anon public** key (a long string under "Project API keys")

---

## Step 2 — Put the project on GitHub

1. Go to [github.com](https://github.com) and create a new **private** repository called `masters-sweepstakes`.
2. On your computer, open a terminal in this project folder and run:

```bash
npm install
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/masters-sweepstakes.git
git push -u origin main
```

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up (use your GitHub account).
2. Click **Add New → Project**.
3. Find and import your `masters-sweepstakes` repository.
4. Before clicking Deploy, expand **Environment Variables** and add these three:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL from Step 1 |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 1 |
| `VITE_ADMIN_PASSWORD` | Any password you choose for the admin panel |

5. Click **Deploy**. Vercel builds the app (~1 minute).
6. Your site is live! Vercel gives you a URL like `https://masters-sweepstakes.vercel.app`.

---

## Step 4 — Share with your group

Send your group the Vercel URL. They visit the site, enter their name, pick their golfers, and submit.

- Entries are open by default.
- You lock entries by going to `/admin`, signing in with your password, and toggling **Lock entries**.
- Once locked, toggle **Show entries publicly** to reveal everyone's picks on the `/entries` page.

---

## How each page works

| Page | URL | Purpose |
|------|-----|---------|
| Entry form | `/` | Where your group submits picks |
| All entries | `/entries` | Public view of everyone's picks (hidden until you reveal) |
| Admin panel | `/admin` | Your control centre — manage entries, paid status, lock/unlock |

---

## Admin features

- **Lock entries** — closes the entry form so no new or edited submissions come in
- **Show entries publicly** — reveals the `/entries` page to everyone
- **Paid toggles** — mark each person as paid with a single click
- **Prize pool calculator** — automatically shows 1st/2nd/3rd prize splits based on how many entries are in
- **Delete entry** — remove any entry if needed

---

## Running locally (optional)

If you want to test the app on your computer before deploying:

1. Copy `.env.example` to `.env` and fill in your Supabase values and a test admin password.
2. Run:

```bash
npm install
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173)

---

## Phase 3 — Live leaderboard (coming soon)

The next phase will add a live leaderboard that automatically pulls scores from the Masters and calculates each team's score based on the sweepstakes rules (3 lowest scores, cut qualification, tiebreakers).
