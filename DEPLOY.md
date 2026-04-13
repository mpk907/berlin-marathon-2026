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
| WHOOP auto-sync | Phase 2 |
| Database backend | Phase 2 |

---

## Project structure

```
berlin-marathon-app/
├── src/
│   ├── app/
│   │   ├── layout.js           ← HTML shell
│   │   ├── page.js             ← imports Dashboard
│   │   ├── globals.css          ← Tailwind
│   │   └── api/sync/route.js   ← WHOOP sync stub
│   ├── components/
│   │   └── Dashboard.jsx       ← the whole dashboard
│   └── lib/
│       └── data.js             ← all training data (edit this to update)
├── vercel.json                 ← cron config
├── package.json
└── DEPLOY.md                   ← this file
```

**To update training data:** edit `src/lib/data.js`, then git push.

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

## Phase 2: WHOOP auto-sync

When you're ready to wire up live WHOOP data:

1. Register at [developer.whoop.com](https://developer.whoop.com)
2. Get Client ID + Secret
3. Add env vars in Vercel → Settings → Environment Variables:
   - `WHOOP_CLIENT_ID`
   - `WHOOP_CLIENT_SECRET`
   - `WHOOP_REFRESH_TOKEN` (from your existing `whoop_config.json`)
4. I'll build out the `/api/sync` route to pull activities and write to a database

The `vercel.json` already has a daily cron job configured — just needs the API route wired up.
