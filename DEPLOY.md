# Deploy Your Marathon Dashboard

You need: a Mac with internet. Total time: ~10 minutes.

---

## Step 1: Install tools (one time only)

Open **Terminal** (Cmd + Space → type "Terminal" → Enter).

Copy-paste each line, press Enter, wait for it to finish:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

```bash
brew install node git gh
```

Check they work:

```bash
node --version
git --version
gh --version
```

All three should print a version number. If not, close Terminal, reopen, try again.

---

## Step 2: Open the project

In Terminal, navigate to the app folder. Easiest way:

1. Type `cd ` (with a space after)
2. Drag the `berlin-marathon-app` folder from Finder into Terminal
3. Press Enter

Then install dependencies:

```bash
npm install
```

Takes ~30 seconds. Ignore yellow warnings.

---

## Step 3: Test locally

```bash
npm run dev
```

Open browser → go to **http://localhost:3000**

You should see:
- Blue "Next Training" card at the top (shows tomorrow's session with HR zone + pace)
- KPI strip (Last Week, Longest Run, Last Pace, etc.)
- Charts (Volume, Pace Progression, Long Run, Z2 Trend)
- Training Plan with expandable weeks

Press **Ctrl + C** in Terminal to stop.

---

## Step 4: Push to GitHub

```bash
gh auth login
```

Follow the prompts — it opens your browser to authorize. Choose:
- GitHub.com
- HTTPS
- Yes (authenticate)
- Login with browser

Then:

```bash
git init
git add .
git commit -m "Berlin Marathon training dashboard"
gh repo create berlin-marathon-2026 --public --push --source=.
```

Done. Code is on GitHub.

---

## Step 5: Deploy to Vercel

1. Open **[vercel.com](https://vercel.com)** in your browser
2. Click **Sign Up** → **Continue with GitHub**
3. Click **Add New Project**
4. Find **berlin-marathon-2026** → click **Import**
5. Leave everything default
6. Click **Deploy**

Wait ~60 seconds.

You get a URL like: **berlin-marathon-2026.vercel.app**

That's your live dashboard. Bookmark it. Works on phone too.

---

## Step 6: Update the dashboard

Whenever you want to update (new WHOOP data, tweaks, etc.):

```bash
cd path/to/berlin-marathon-app
git add .
git commit -m "update data"
git push
```

Vercel auto-deploys in ~30 seconds. Refresh browser.

---

## Optional: Custom domain

Want **max-runs-berlin.de** instead of the Vercel URL?

1. Buy domain (~12 EUR/year, Namecheap or Cloudflare)
2. Vercel → your project → Settings → Domains → Add
3. Follow the DNS instructions (2 minutes)

---

## What you get

| Feature | Status |
|---------|--------|
| Next Training card (today/tomorrow + HR zone + pace) | ✅ Live |
| KPI strip (last week, pace, longest run, adherence) | ✅ Live |
| Weekly volume vs plan chart | ✅ Live |
| Pace progression chart (with race target line) | ✅ Live |
| Long run trajectory chart | ✅ Live |
| Zone 2 % trend chart | ✅ Live |
| Training Plan with expandable HR/pace detail | ✅ Live |
| Weekly Detail table (pace, HR, Z2 per week) | ✅ Live |
| Heart Rate tab with zone reference card | ✅ Live |
| Marathon projection (4:30 / 4:45 / 5:00) | ✅ Live |
| WHOOP auto-sync (daily cron) | ✅ Live |
| Vercel Blob storage | ✅ Live |
| Manual sync button in dashboard | ✅ Live |

---

## Project structure

```
berlin-marathon-app/
├── src/
│   ├── app/
│   │   ├── layout.js              ← HTML shell
│   │   ├── page.js                ← imports Dashboard
│   │   ├── globals.css            ← Tailwind
│   │   └── api/
│   │       ├── sync/route.js      ← WHOOP sync (cron + manual)
│   │       └── activities/route.js ← Returns data for dashboard
│   ├── components/
│   │   └── Dashboard.jsx          ← the whole dashboard
│   └── lib/
│       ├── data.js                ← static fallback data
│       ├── whoop.js               ← WHOOP API client
│       └── storage.js             ← Vercel Blob / local storage
├── vercel.json                    ← cron config (daily 5am sync)
├── package.json
└── DEPLOY.md                      ← this file
```

**Data flow:** Cron (5am daily) → `/api/sync` → WHOOP API → Vercel Blob → `/api/activities` → Dashboard

**To update training plan:** edit `src/lib/data.js` (the `trainingPlan` array), then git push.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `command not found: node` | `brew install node`, restart Terminal |
| `npm install` fails | Delete `node_modules/` and `package-lock.json`, retry |
| localhost:3000 is blank | Check Terminal for red errors |
| Vercel deploy fails | Run `npm run build` locally first to find the error |
| Broke everything | `git checkout .` resets all files to last commit |

---

## WHOOP auto-sync setup

The sync is fully built. You just need two things: your WHOOP refresh token and a Vercel Blob store.

### Get your WHOOP refresh token

1. Open **[app.whoop.com](https://app.whoop.com)** in Chrome
2. Press **F12** → **Application** tab → **Cookies**
3. Find the cookie with a very long value that starts with `eyJ...` — that's your Cognito refresh token
4. Copy the full value

Alternative: check your existing `whoop_config.json` — if it has a `refresh_token` field, use that.

### Add Vercel Blob store

1. Go to **Vercel** → your project → **Storage** tab
2. Click **Create** → **Blob**
3. Name it anything (e.g. `marathon-data`)
4. Click **Connect** — this auto-adds `BLOB_READ_WRITE_TOKEN` to your env vars

### Add environment variables

1. Vercel → your project → **Settings** → **Environment Variables**
2. Add: `WHOOP_REFRESH_TOKEN` = (the token from step 1)
3. `BLOB_READ_WRITE_TOKEN` should already be there from the Blob setup
4. Click **Redeploy** (Deployments tab → most recent → ... → Redeploy)

### Test it

After redeploying:

1. Open your dashboard
2. Click the **Sync WHOOP** button in the header
3. Wait ~15 seconds — the dashboard will refresh with live data
4. The green dot in the header confirms WHOOP is connected

The daily cron job (`vercel.json`) syncs automatically at 5am UTC every day.

### Refresh token expired?

WHOOP refresh tokens last months, but if sync stops working:

1. Repeat the "Get your WHOOP refresh token" steps above
2. Update `WHOOP_REFRESH_TOKEN` in Vercel env vars
3. Redeploy
