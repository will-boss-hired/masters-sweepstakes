# The Masters 2026 Sweepstakes — Setup Guide

Follow these steps in order. The whole process takes about 20 minutes.

---

## Step 1 — Create your Supabase database (free)

1. Go to https://supabase.com and sign up for a free account
2. Click **New project** — give it a name like "masters-sweepstakes"
3. Choose a strong database password (save it somewhere) and pick a region closest to you
4. Wait ~2 minutes for it to spin up
5. Go to **SQL Editor** in the left sidebar
6. Copy the entire contents of `supabase-schema.sql` and paste it into the editor
7. Click **Run** — you should see "Success"
8. Go to **Settings > API** and copy:
   - **Project URL** (looks like `https://xyz.supabase.co`)
   - **anon public** key (a long string)

---

## Step 2 — Set up the code on your computer

1. Make sure you have **Node.js** installed (https://nodejs.org — download the LTS version)
2. Unzip this folder somewhere on your computer
3. Open a terminal (Mac: search "Terminal", Windows: search "Command Prompt")
4. Navigate to the folder: `cd path/to/masters-sweepstakes`
5. Install dependencies: `npm install`
6. Copy the example env file: `cp .env.local.example .env.local`
7. Open `.env.local` in any text editor and fill in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ADMIN_PASSWORD=choose-a-password-only-you-know
   ```
8. Test it locally: `npm run dev`
9. Open http://localhost:3000 — you should see the entry form!

---

## Step 3 — Deploy to Vercel (free hosting)

1. Go to https://vercel.com and sign up (you can sign in with GitHub)
2. Install Vercel CLI: `npm install -g vercel`
3. In your terminal (in the project folder): `vercel`
4. Follow the prompts — accept all defaults
5. When asked about environment variables, add your three variables from `.env.local`
   (or add them in the Vercel dashboard under Project > Settings > Environment Variables)
6. Your site will be given a URL like `https://masters-sweepstakes-xyz.vercel.app`
7. Share that URL with your friends!

---

## How to use it during the tournament

### Before the tournament (entries open)
- Share the site URL with your friends
- They fill in their name, pick 6 golfers, and submit
- They can come back and edit until you lock it
- Go to `/admin` and log in with your admin password to see all entries
- Mark people as "Paid" as the money comes in

### Lock entries (7pm Wednesday or whenever you're ready)
- Go to `/admin > Settings`
- Toggle **"Lock entries"** ON — no more submissions or edits

### Reveal picks and open leaderboard
- In `/admin > Settings`, toggle **"Show picks & leaderboard"** ON
- Everyone can now see all picks at `/picks` and the leaderboard at `/leaderboard`
- The leaderboard auto-refreshes every 60 seconds with live scores during the tournament

---

## Pages

| URL | What it is |
|-----|-----------|
| `/` | Entry form — where friends submit their picks |
| `/picks` | All picks visible (after you unlock) |
| `/leaderboard` | Live leaderboard (after you unlock) |
| `/admin` | Your admin panel — password protected |

---

## Troubleshooting

**"Cannot connect to Supabase"** — double-check the URL and key in `.env.local`. No trailing spaces.

**"Entries are locked" on the form** — go to admin, check the locked toggle.

**Leaderboard shows "—" for all scores** — the Masters hasn't started yet, or ESPN's API isn't returning data for that event yet. It will populate automatically once play begins.

**Someone submitted with the wrong name** — go to admin, delete their entry, ask them to resubmit.

