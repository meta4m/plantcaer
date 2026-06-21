# Plantcaer — Setup Guide

> A complete walkthrough to get Plantcaer running locally and deployed to production.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Supabase Setup](#3-supabase-setup)
4. [Environment Variables](#4-environment-variables)
5. [Database Migrations](#5-database-migrations)
6. [Seed Data](#6-seed-data)
7. [Running the App](#7-running-the-app)
8. [App Walkthrough](#8-app-walkthrough)
9. [AI Configuration](#9-ai-configuration)
10. [Deploy to Vercel](#10-deploy-to-vercel)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

| Tool | Required | Notes |
|---|---|---|
| **Node.js** >= 20 | ✅ | Download from [nodejs.org](https://nodejs.org/) |
| **npm** (comes with Node) | ✅ | Alternatively `pnpm` or `yarn` |
| **Supabase CLI** | Optional | For local development — `npm install -g supabase` |
| **Git** | ✅ | For version control |
| **GitHub CLI (`gh`)** | Optional | For creating the GitHub repo — `npm install -g gh` |
| **Vercel CLI** | Optional | For deploying — `npm install -g vercel` |

Verify your setup:
```bash
node --version   # Should be >= 20
npm --version    # Should be >= 10
git --version    # Should be >= 2.x
```

---

## 2. Quick Start

```bash
# 1. Install dependencies
cd plantcaer
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and AI credentials

# 3. Apply database migrations (see Section 5)
# 4. Seed sample data (see Section 6)
# 5. Start development server
npm run dev

# 6. Open http://localhost:3000
```

---

## 3. Supabase Setup

### Option A: Cloud Project (Recommended for Deployment)

The project is already linked to a Supabase cloud project:
- **Project ref:** `wrwkhwngxfzmrsswwppq`
- **URL:** `https://wrwkhwngxfzmrsswwppq.supabase.co`

You can also create your own Supabase project at [supabase.com](https://supabase.com).

**To link your local CLI to the cloud project:**
```bash
supabase login
supabase link --project-ref your-project-ref
```

### Option B: Local Supabase (For Development)

```bash
# Start local Supabase services
supabase start

# Stop when done
supabase stop
```

Local Supabase runs on:
- **Studio UI:** http://localhost:54323
- **API:** http://localhost:54321
- **Database:** postgresql://postgres:postgres@localhost:54322/postgres

---

## 4. Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

### Required Variables

| Variable | Description | Where to Get It |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard → Project Settings → API (⚠️ Keep secret — never expose to client) |
| `AI_API_KEY` | AI provider API key | Google AI Studio, Groq, OpenAI, or Anthropic dashboard |

### Optional Overrides

| Variable | Default | Description |
|---|---|---|
| `AI_PROVIDER` | `google` | `google`, `groq`, `openai`, or `anthropic` |
| `AI_MODEL` | `gemini-3.5-flash` | Model name for the chosen provider |
| `AI_BASE_URL` | (from config) | Custom API endpoint override |

### Getting a Gemini API Key (Free)

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click **"Get API Key"** in the left sidebar
3. Click **"Create API Key"** → select a Google Cloud project
4. Copy the key and paste it as `AI_API_KEY` in `.env.local`

> **Gemini 3.5 Flash has a generous free tier** — enough for a household garden of ~100 plants.

---

## 5. Database Migrations

The initial schema is in `supabase/migrations/00001_initial_schema.sql`.

### Apply to Cloud Project

**Option A: Via Supabase CLI**
```bash
supabase login
supabase db push
```

**Option B: Via SQL Editor (Easier)**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/wrkwhwngxfzmrsswwppq)
2. Navigate to **SQL Editor**
3. Open `supabase/migrations/00001_initial_schema.sql`
4. Copy the entire contents
5. Paste into the SQL Editor and click **"Run"**

### Apply to Local Supabase
```bash
supabase db reset
```

This creates all tables:
- `profiles` — user profiles (synced with auth)
- `plants` — plant catalog
- `plant_photos` — uploaded plant photos
- `care_tasks` — care configurations per plant
- `care_logs` — when care was actually performed
- `growth_records` — plant growth tracking
- `journal_entries` — notes about plants
- `plant_shares` — multi-user sharing (future)

Plus Row-Level Security (RLS) policies for all tables.

---

## 6. Seed Data

Sample plant data is provided in `scripts/seed-plants.mjs` with **10 realistic houseplants**, each with care tasks and care logs.

### Prerequisites

- An admin user must exist in Supabase Auth (see below)
- `.env.local` must have `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

### Create Admin User

```bash
node scripts/create-admin.mjs
```

This creates:
- **Email:** `iullahs@gmail.com`
- **Password:** `admin`

### Seed Plants

```bash
node scripts/seed-plants.mjs
```

Expected output:
```
✅ 10 plants, 29 care tasks, 20 care logs inserted.
```

### Seeded Plants

| # | Plant | Nickname | Tasks |
|---|---|---|---|
| 1 | Monstera Deliciosa | Manny | Watering, Fertilizing, Pruning |
| 2 | Snake Plant | Slytherin | Watering, Repotting |
| 3 | Golden Pothos | Trailblazer | Watering, Fertilizing, Pruning, Propagation |
| 4 | Fiddle Leaf Fig | Fiona | Watering, Fertilizing, Pruning |
| 5 | Peace Lily | Serenity | Watering, Fertilizing, Pruning |
| 6 | ZZ Plant | Zorro | Watering, Repotting |
| 7 | Spider Plant | Charlotte | Watering, Fertilizing, Propagation |
| 8 | Aloe Vera | Sunny | Watering, Fertilizing, Repotting |
| 9 | Calathea Orbifolia | Orbie | Watering, Fertilizing, Pruning |
| 10 | String of Pearls | Pearl Jam | Watering, Fertilizing, Propagation |

Each plant has 2-4 realistic care logs with timestamps going back several weeks, so the dashboard shows upcoming/overdue tasks immediately.

---

## 7. Running the App

### Development

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

### Login

Use the admin credentials:
- **Email:** `iullahs@gmail.com`
- **Password:** `admin`

---

## 8. App Walkthrough

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | **Dashboard** | Overview — plant count, upcoming care tasks, recent activity, plant grid |
| `/plants` | **Plants List** | All plants in a card grid — tap to view details |
| `/plants/new` | **Add Plant** | Form to add a new plant with name, location, light, temp, humidity |
| `/plant/[slug]` | **Plant Details** | Full plant info, care tasks, care log, journal, **QR code** |
| `/plant/[slug]/edit` | **Edit Plant** | Edit the plant's details |
| `/care` | **Care Overview** | All active care tasks grouped by plant with log buttons |
| `/auth/login` | **Login** | Sign in with email/password |
| `/auth/signup` | **Sign Up** | Create a new account |

### Key Features

#### Dashboard
- Stats cards: total plants, active tasks, overdue tasks, total logs
- "Upcoming Care" panel — shows tasks that are due or overdue, sorted by urgency
- "Recent Activity" panel — shows the last 10 care logs
- Plant grid with links to each plant's detail page

#### Plant Detail Page
- Plant info card (name, location, light, temperature, humidity)
- Care tasks list with log buttons (✅ Mark as Done)
- Care log — history of all care performed
- Journal entries — add notes about the plant
- QR code button (planned — see MVP-REQUIREMENTS.md)

#### Care Overview
- All plants with their care tasks grouped together
- Log care directly from this page
- Visual indicators for overdue tasks

### Glassmorphism Theme

The app uses a dark emerald glassmorphism design:
- Dark green gradient background
- Glass-card components with backdrop blur
- Emerald green accent colors
- Smooth transitions and hover effects

---

## 9. AI Configuration

Plantcaer supports multiple AI providers for plant identification from photos. The system is fully configurable.

### Configuration Files

| File | Purpose |
|---|---|
| `config/ai-config.json` | Non-sensitive defaults (provider, model, endpoints) |
| `.env.local` | Secrets (API keys) and runtime overrides |

### Supported Providers

| Provider | Default Model | Free Tier | Config Value |
|---|---|---|---|
| **Google Gemini** | `gemini-3.5-flash` | ✅ Rate-limited free tier | `google` |
| **Groq** | `llama-4-scout-17b` | ✅ 30 RPM free tier | `grog` |
| **OpenAI** | `gpt-5.4-mini` | ❌ $5 one-time credits | `openai` |
| **Anthropic** | `claude-haiku-4.5` | ❌ Pay-as-you-go | `anthropic` |

### Changing Providers

To switch from Gemini to Groq (or any other provider):

```bash
# In .env.local
AI_PROVIDER=groq
AI_MODEL=llama-4-scout-17b
AI_API_KEY=your_groq_api_key
```

No code changes needed.

### Architecture

```
Client (Add Plant page)
  │
  ▼
Server Action (src/lib/ai-client.ts)
  │
  ├─► Config Loader (config/ai-config.json + .env.local)
  │      └─► Determines provider, model, endpoint, API key
  │
  └─► Provider Adapter
         ├─► Google Gemini REST API
         ├─► Groq/OpenAI Chat Completions API
         └─► Anthropic Messages API
              │
              ▼
         Returns structured JSON → Auto-fills the add plant form
```

---

## 10. Deploy to Vercel

### Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free tier)

### Step 1: Create a GitHub Repository

```bash
# Initialize git (if not already done)
cd plantcaer
git init
git add .
git commit -m "Initial commit: Plantcaer plant care tracker"

# Create GitHub repo and push
gh repo create plantcaer --public --source=. --remote=origin --push
```

### Step 2: Deploy to Vercel

```bash
# Via CLI
vercel login
vercel --prod
```

Or via the Vercel Dashboard:
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your `plantcaer` GitHub repo
3. Configure environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AI_API_KEY`
4. Click **"Deploy"**

### Step 3: Supabase Auth Configuration (Important!)

After deploying, update your Supabase project's auth settings:

1. Go to **Supabase Dashboard → Authentication → Provider Settings**
2. Under **"Site URL"**, set it to your Vercel deployment URL:

   ```
   https://your-app.vercel.app
   ```

3. Under **"Additional Redirect URLs"**, add:

   ```
   https://your-app.vercel.app/auth/callback
   ```

4. **Save** the changes.

### Step 4: Verify Deployment

1. Visit `https://your-app.vercel.app`
2. Login with your admin credentials
3. Check the dashboard shows your seeded plants
4. Try navigating between pages

---

## 11. Troubleshooting

### "Supabase Auth Error: Invalid login credentials"

- Ensure you've run `node scripts/create-admin.mjs` first
- Check that `.env.local` has correct Supabase credentials
- Verify the user's email is confirmed (check Supabase Auth dashboard)

### "Relation 'plants' does not exist"

- The database migration hasn't been applied yet
- Run the SQL from `supabase/migrations/00001_initial_schema.sql` in Supabase SQL Editor

### "Next.js build fails"

- Kill stale processes: `pkill -f "next"`
- Clear cache: `rm -rf .next`
- Retry: `npm run build`

### "AI API returns error"

- Check `AI_API_KEY` in `.env.local` is correct
- Verify the AI provider is set correctly in `config/ai-config.json` or overridden in `.env.local`
- Check the provider's dashboard for rate limits

### "Port 3000 already in use"

```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

### "gh: not authenticated"

```bash
gh auth login
# Follow the browser-based authentication flow
```

---

## Next Steps

Now that Plantcaer is running, here's what you can do:

1. **Explore the app** — navigate through all pages, log some care tasks
2. **Check the roadmap** — read `MVP-REQUIREMENTS.md` for planned features
3. **Configure AI** — get a Gemini API key and test plant identification
4. **Customize** — edit `config/ai-config.json` to switch AI providers
5. **Deploy** — share your Plantcaer with your family!

---

_Plantcaer — Made with 🪴 by your family, for your family_
