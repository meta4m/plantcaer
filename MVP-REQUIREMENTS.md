# Plantcaer — MVP Requirements (Updated)

> **Status:** Final Draft — Ready for Implementation
> **Date:** June 21, 2026
> **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · PWA · AI (configurable provider)

---

## 1. MVP Scope (3 Features)

The MVP consists of three focused features, designed to be implemented incrementally:

1. **🤖 AI-Powered Plant ID from Photo** — Snap a plant photo, AI identifies it and auto-fills the add-plant form (with user confirmation)
2. **🏷️ QR Code Pot Stickers** — Generate and print QR codes for each plant to stick on pots for quick in-app lookup
3. **🔑 Single-User PIN Mode** — Replace individual auth with a shared household PIN. Any family member with the app can do everything.

**Out of scope for MVP** (but listed for awareness):
- Multi-user sharing/invites
- Offline support / IndexedDB sync
- Push notifications
- Dark/light mode toggle
- Growth tracking timeline UI
- In-app QR scanner (use phone's camera app instead)
- Seasonal schedule adjustments UI

---

## 2. Feature 1: AI-Powered Plant ID + Auto-Fill

### 2.1 User Flow

```
1. User opens "Add Plant" page
2. User taps 📷 camera icon / "Upload Photo" button
3. User takes a photo or selects from gallery
4. Photo is sent to AI provider (server-side)
5. AI identifies the plant and returns structured data:
   - Common name, scientific name, light requirement
   - Temperature range, humidity preference
   - Suggested care tasks (watering frequency, fertilizing, etc.)
   - General notes
6. Form is pre-filled with AI data, shown to user for review
7. User confirms/corrects any fields, then submits
```

### 2.2 AI Provider Configuration (Provider-Agnostic)

The AI layer is fully configurable via a **JSON config file + environment variable hybrid**:

**Non-sensitive config** (`config/ai-config.json`):
```json
{
  "provider": "google",
  "model": "gemini-3.5-flash",
  "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
}
```

**Sensitive env vars** (`.env.local`):
```env
AI_API_KEY=your_key_here
# Optional overrides (takes precedence over JSON config):
# AI_PROVIDER=groq
# AI_MODEL=llama-4-scout-17b
# AI_BASE_URL=https://api.groq.com/openai/v1
```

**Supported providers (extensible):**
| Provider | Model | Vision? | Free Tier? |
|---|---|---|---|
| `google` (default) | Gemini 3.5 Flash | ✅ Native | ✅ Yes (rate-limited) |
| `groq` | Llama 4 Scout 17B | ✅ Yes | ✅ Yes (30 RPM, 1K+ RPD) |
| `openai` | GPT-5.4 mini | ✅ Yes | ❌ ($5 one-time credits) |
| `anthropic` | Claude Haiku 4.5 | ✅ Yes | ❌ None |

Adding a new provider = add entry to JSON config + environment variable for API key.

### 2.3 AI Response Schema

The AI must return structured JSON matching this schema:

```typescript
interface AiPlantSuggestion {
  common_name: string;
  scientific_name: string;
  light_requirement: 'direct_sun' | 'bright_indirect' | 'low_light' | 'shade';
  min_temp: number;       // Celsius
  max_temp: number;       // Celsius
  humidity_min: number;   // Percentage
  notes: string;          // General care notes
  care_tasks: {
    task_type: 'watering' | 'fertilizing' | 'repotting' | 'pruning' | 'pest_disease' | 'propagation';
    frequency_days: number;
    amount: string;       // e.g. "200ml", "1 cup"
    notes: string;
  }[];
}
```

### 2.4 User Confirmation (Hallucination Guard)

AI suggestions are **never saved automatically**. The flow:
1. AI populates the form ⟶ user reviews
2. User can edit any field
3. User explicitly clicks "Add Plant" to save

Additionally, a **"Copy as prompt"** button is available on the plant detail page that formats the plant's data as a text prompt the user can paste into ChatGPT, Gemini Chat, or Claude to independently verify the AI's recommendations.

### 2.5 Photo Upload / Storage

- Photos are uploaded to **Supabase Storage** (`plant-photos` bucket)
- The photo used for AI identification is saved as the plant's primary photo
- Future growth timeline photos will use the same bucket
- If Supabase free tier storage fills up, the config can be updated to use S3-compatible storage (Backblaze B2, Cloudflare R2, etc.)

---

## 3. Feature 2: QR Code Pot Stickers

### 3.1 User Flow

```
1. User opens plant detail page
2. Taps "🏷️ QR Code" button
3. App displays a QR code encoding the plant's slug URL
4. User can:
   a. Print a sticker sheet with all plants' QR codes
   b. Save individual QR code as image
5. User sticks the QR code on the plant pot
6. Any family member scans the QR with their phone camera
7. QR opens the plant's detail page in the app
```

### 3.2 QR Code Content

Each QR code encodes the URL:
```
https://plantcaer.vercel.app/plant/{slug}
```

### 3.3 Print Layout

- A printable page showing QR codes for ALL plants in a grid
- Grid with cutter-guide lines (e.g. 3×3 grid, 2×2 inch stickers)
- Each sticker shows: QR code + plant name (common name)
- Print via browser's `window.print()` for maximum compatibility

### 3.4 Implementation

- Library: `qrcode.react` (already in `package.json`)
- QR display component on plant detail page or dedicated `/plant/[slug]/qr` route
- QR sticker sheet on `/plants/qr-print` route

---

## 4. Feature 3: Single-User PIN Mode

### 4.1 Problem

The current app requires individual Supabase Auth logins/signups. For a household/family sharing a single collection, this is unnecessary friction.

### 4.2 Solution: Shared PIN

- Replace Supabase Auth with a **single shared PIN**
- PIN is configured once during first-time setup (in `.env.local` or set via a one-time setup page)
- All future access requires entering the PIN
- No user accounts, no profiles, no individual ownership
- **All plant data is owned by a single system user** (or stored without owner_id)

### 4.3 Architecture

**Option A (Recommended): Bypass RLS, use a service role key**
- Store a `SERVER_PIN` in `.env.local`
- Create a simple PIN verification page (cookie-based)
- Once verified, store a signed cookie/token
- All Supabase queries use the **service role key** (bypasses RLS)
- Middleware checks for the PIN cookie on protected routes

**Option B: Keep auth, auto-login**
- Create a single Supabase auth user for the household
- Store credentials in `.env.local`
- Server-side auto-login with those credentials on PIN entry
- All queries use that user's context

**Recommendation: Option A** — simpler, no need to manage auth sessions, clean separation.

### 4.4 Changes Required

| Area | Change |
|---|---|
| Middleware | Replace Supabase auth check with PIN cookie check |
| Server components | Use service role client instead of user-scoped client |
| Client components | Remove `owner_id` from queries (no user context) |
| Auth UI | Remove login/signup pages, replace with PIN entry page |
| Database | Make `owner_id` nullable or use a fixed system user ID |
| RLS Policies | Either disable RLS for the affected tables or create a service-role bypass |

---

## 5. Additional Features

### 5.1 Copy-as-Prompt (Validation Layer)

A button on the plant detail page that copies a formatted text prompt to clipboard:

```
🌿 Plant: Monstera Deliciosa
Scientific name: Monstera deliciosa
Light: Bright indirect
Temperature: 18-30°C
Humidity: 60-80%

Care schedule:
- 💧 Watering: Every 7 days (200ml)
- 🌱 Fertilizing: Every 30 days (balanced liquid fertilizer)
- ✂️ Pruning: As needed
- 🔄 Repotting: Every 12 months

Notes: Native to tropical rainforests. Needs well-draining soil. Toxic to pets.
```

User pastes this into ChatGPT, Gemini Chat, or Claude to cross-check the AI's recommendations.

### 5.2 Plant Photos / Gallery

- The `plant_photos` table already exists in the schema
- Upload photos via the add-plant form or plant detail page
- Display a photo gallery on the plant detail page
- First photo = primary/thumbnail photo
- Storage: Supabase Storage (`plant-photos` bucket)

---

## 6. Database Changes

### 6.1 Minimal Changes for MVP

The existing schema is mostly sufficient. Changes needed:

1. **`plants` table**: Make `owner_id` nullable (or use a fixed system UUID for all plants)
2. **PIN storage**: Store PIN hash in a new `app_settings` table (single row) or `.env.local`
3. **`plant_photos` table**: Already exists, no changes needed
4. **RLS policies**: Either disable RLS on `plants` and related tables, or create service-role policies

### 6.2 New `app_settings` Table (Optional)

If PIN is stored in DB (for runtime configurability):
```sql
CREATE TABLE app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  pin_hash text NOT NULL,
  ai_provider text DEFAULT 'google',
  ai_model text DEFAULT 'gemini-3.5-flash',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
```

---

## 7. Route Changes

| Route | Purpose | Status |
|---|---|---|
| `/` | Dashboard | ✅ Already exists |
| `/plants` | Plant list | ✅ Already exists |
| `/plants/new` | Add Plant **(+ AI auto-fill)** | 🔄 Update |
| `/plant/[slug]` | Plant detail **(+ QR code, copy-as-prompt)** | 🔄 Update |
| `/plant/[slug]/edit` | Edit plant | ✅ Already exists |
| `/plant/[slug]/qr` | QR code display + print | 🆕 New |
| `/plants/qr-print` | QR sticker sheet for all plants | 🆕 New |
| `/care` | Care overview | ✅ Already exists |
| `/auth/pin` | PIN entry page | 🆕 New |
| `/auth/login` | Remove/redirect | ❌ Remove |
| `/auth/signup` | Remove/redirect | ❌ Remove |

---

## 8. Implementation Order

The features are independent enough to be built in parallel or sequence:

### Phase A — Foundation (Config + PIN)
1. Create AI configuration system (JSON + env vars)
2. Implement PIN-based single-user mode (replace Supabase Auth)
3. Update middleware, server/client components to work without auth

### Phase B — AI Plant ID
4. Build AI client factory (provider-agnostic)
5. Create server action for AI plant identification
6. Update Add Plant form with photo upload + AI auto-fill
7. Add copy-as-prompt button to plant detail page

### Phase C — QR Codes + Polish
8. Add QR code display to plant detail page
9. Create QR print sticker sheet
10. Add plant photo gallery support

---

## 9. Environment Variables

```env
# === Supabase ===
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# === PIN Mode (replace Supabase Auth) ===
APP_PIN=1234

# === AI Provider (configurable) ===
# Provider defaults are in config/ai-config.json
# Use env vars to override for secrets or temporary changes
AI_API_KEY=your_ai_api_key

# Optional overrides (take precedence over config/ai-config.json):
# AI_PROVIDER=google
# AI_MODEL=gemini-3.5-flash
# AI_BASE_URL=
```

---

## 10. Open Decisions

| Question | Decision |
|---|---|
| PIN stored in DB or `.env.local`? | **`.env.local` for MVP** (simpler, no DB migration needed) |
| AI provider config in JSON or DB? | **JSON file + env var overrides** (easy to change, env vars for secrets) |
| Photo storage bucket name? | `plant-photos` (matching Supabase config) |
| QR code content? | Full URL to plant page (`/plant/{slug}`) |
| Single-user Supabase role? | **Service role key** (bypasses RLS entirely for PIN mode) |
| Need a migration for `owner_id`? | Yes — make nullable, or use a fixed UUID |
