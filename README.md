# 🧱 Bricker Billy — LEGO Investment Dashboard

A dark-mode React dashboard that tracks your LEGO inventory, identifies high-ROI sell opportunities, shows charts, and generates AI-powered Facebook Marketplace ads.

---

## Architecture

```
bricker-billy/
├── sync_lego.py              # Python data sync (runs via GitHub Actions)
├── .github/workflows/
│   └── sync.yml              # Daily cron + manual trigger
├── public/
│   └── data.json             # Auto-generated output (committed by bot)
├── src/
│   ├── App.jsx               # Main dashboard
│   ├── components/
│   │   ├── SetCard.jsx       # Per-set card with listing tracker
│   │   ├── AdModal.jsx       # AI ad copy modal
│   │   ├── Charts.jsx        # Recharts visualizations
│   │   ├── SummaryBar.jsx    # Portfolio summary stats
│   │   └── Badges.jsx        # Signal + marketplace badges
│   ├── index.css
│   └── main.jsx
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

---

## 1. GitHub Secrets — Add These First

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|---|---|
| `SPREADSHEET_ID` | The ID from your Google Sheet URL (the long string between `/d/` and `/edit`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON content of your Google service account key file |
| `BL_CONSUMER_KEY` | BrickLink API consumer key |
| `BL_CONSUMER_SECRET` | BrickLink API consumer secret |
| `BL_TOKEN` | BrickLink OAuth access token |
| `BL_TOKEN_SECRET` | BrickLink OAuth access token secret |
| `GEMINI_API_KEY` | API key from [Google AI Studio](https://aistudio.google.com/app/apikey) |

---

## 2. Google Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google Sheets API**
3. Create a **Service Account** → Generate a JSON key → copy the entire JSON content as the `GOOGLE_SERVICE_ACCOUNT_JSON` secret
4. Share your Google Sheet with the service account's email address (view-only is fine)

---

## 3. BrickLink API Setup

1. Log in to BrickLink → **My BrickLink → API**
2. Create a new consumer (app) → note the Consumer Key and Secret
3. Generate a token key pair → note the Token and Token Secret
4. Set IP = your GitHub Actions IPs (or leave open for testing)

---

## 4. Local Development

```bash
# Install dependencies
npm install

# Start dev server (uses public/data.json as the data source)
npm run dev
```

The dev server runs at **`http://localhost:5173`** and hot-reloads on every file save. The `public/data.json` already in the repo has your set data, so the dashboard loads immediately with real data.

---

## 5. Cross-Device Sync (GitHub Token)

Manual sets you add in the dashboard are written back to `public/manual_sets.json` in the repo via the GitHub API. This means they'll be visible on every device after the next deploy (usually takes 1–2 minutes).

**To enable write access, connect a GitHub Personal Access Token on each new device:**

1. Click the **Connect** button (GitHub icon) in the top-right of the dashboard
2. A dialog will walk you through creating a token at [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=repo&description=Bricker+Billy)
3. Paste the token and click **Connect** — it's verified and saved in that browser's `localStorage` only

> **Security note:** The token is never baked into the deployed JavaScript bundle. It lives only in your browser's local storage and is sent only to `api.github.com` over HTTPS.

You can disconnect at any time with the same button (turns green when connected). Without a token the dashboard still works fully — you just won't be able to write new manual sets back to the repo from that device.

---

## 6. Deploying to GitHub Pages

```bash
npm run build
```

Then enable **GitHub Pages** in your repo settings, pointing at the `gh-pages` branch or `docs/` folder. Or add this GitHub Action to auto-deploy on push:

**.github/workflows/deploy.yml**
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## 7. Business Rules

| Signal | Criteria |
|---|---|
| 🔥 **Strong Sell** | ROI ≥ 40% AND BrickLink value ≥ CAD $50 |
| 👀 **Consider** | ROI ≥ 20% |
| 💤 **Hold** | Everything else |
| ❓ **No Data** | Set not found on BrickLink |

- **Gemini AI ads** are only generated for Strong Sell candidates
- **Marketplace status** (Not Listed / BrickLink / Facebook / Both) is saved locally in `localStorage` so it persists between visits without needing a backend
- **Manual sets** added via the dashboard are persisted to `public/manual_sets.json` in the repo (requires GitHub token — see §5) so they appear on every device after the next deploy
- **Sold sets** are persisted to `public/sold_sets.json` in the repo (requires GitHub token on the device where you mark sold) so sold cards stay hidden and visible in the Sold modal across devices after the next deploy
- **Duplicate set entries** are kept separate (each copy of the same set treated independently)
- **Personal notes** that look like single names (e.g., "Ben") are stripped from `data.json` before it's committed

---

## 8. Running the Sync Manually

```bash
# Set environment variables first, then:
python sync_lego.py
```

Or trigger it via **Actions → Daily LEGO Sync → Run workflow** in GitHub.

---

## Google Sheet Column Mapping

Your sheet tab must be named **"New Sets - Revised"** with these columns:

| Column | Header | Usage |
|---|---|---|
| A | Theme | Set theme (Architecture, Star Wars, etc.) |
| B | Set Name | Full set name |
| C | Set Number | e.g., `21045` (script adds `-1` suffix) |
| D | Cost | Price you paid (CAD) |
| E | Current Value | Ignored — BrickLink live data is used |
| F | Selling On | Informational only (BL/FB) |
| G | Notes | Display notes (personal names are auto-stripped) |
