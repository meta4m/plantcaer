# Plantcaer — Personal Plant Care Tracker (Specification)

> **Status:** Draft v1  
> **Date:** June 21, 2026  
> **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · PWA  

---

## 1. Overview

**Plantcaer** is a personal plant care tracking app for houseplant owners who have many plants (indoor + outdoor) and need help keeping track of each plant's unique care requirements. It is a hobby / side project.

### Target user
The user has "dozens" of house plants located both indoors and outdoors. They want a single app to:
- Catalog every plant with detailed information
- Track individualized care schedules (watering, fertilizing, repotting, pruning, pest/disease, propagation)
- Get push notifications when care is due
- Generate QR codes for physical pot tags to quickly log care
- Share access with family/housemates

---

## 2. Core Features

### 2.1 Plant Catalog
Each plant entry stores:

| Field | Type | Notes |
|-------|------|-------|
| Common name | `string` | Required |
| Scientific name | `string` | Optional |
| Nickname | `string` | Optional, for personal reference |
| Species | `string` | Optional, e.g. "Monstera deliciosa" |
| Photos | `string[]` (URLs or uploaded) | Support both device gallery uploads and URL references |
| Location | `string` | Free-text (e.g. "Living room window", "Back porch") |
| Purchase / adoption date | `date` | Optional |
| Care notes / journal | `text` | Free-form, timestamped entries for observations |
| Growth tracking | `object[]` | Time-series: date, height, leaf count, notes |
| QR code identifier | `string` | Short plant name + auto-generated ID (slug) |
| Created at / updated at | `datetime` | Auto-managed |

### 2.2 Care Tasks (all supported)
Different plants have different needs. Each task type can be configured per plant:

| Task | Configurable fields |
|------|-------------------|
| **Watering** | Frequency (smart/seasonal), amount (mL/cups), soil moisture preference |
| **Fertilizing** | Frequency, fertilizer type (liquid, granular, slow-release), dilution ratio |
| **Repotting** | Last repot date, pot size, soil type, recommended interval |
| **Pruning / trimming** | Season, frequency, guidance notes |
| **Pest / disease tracking** | Issue log (date, symptom, treatment, outcome) |
| **Light requirements** | Category (direct sun, bright indirect, low light) |
| **Temperature / humidity** | Min/max temp, humidity range, notes |
| **Propagation** | Cuttings/offsets tracking, linked to parent plant |

### 2.3 Smart / Seasonal Scheduling
- Schedules adjust based on season (e.g. water less in winter, more in summer)
- Default intervals can be configured per task per plant
- Option to factor in temperature, humidity, or soil moisture tracking (future enhancement)

### 2.4 Push Notifications (PWA)
- App must be installable as a PWA
- Push notifications when care tasks become due
- Service worker for offline support
- Notifications can be dismissed or snoozed

### 2.5 QR Code Tag System
- Each plant gets a unique, short, human-readable slug (e.g. `monstera-1`, `snake-plant-3`)
- QR codes encode the slug
- **Two use cases:**
  - **View mode:** Scanning opens the plant's care dashboard in the app
  - **Action mode:** Scanning allows quick actions (e.g. "Mark as watered today", "Log observation")
- **Two delivery formats:**
  - **Printable stickers:** Generate a sheet of QR codes for cutting and sticking on pots
  - **On-screen display:** Show QR code in the app for phone-to-phone scanning

### 2.6 Multi-User / Shared Access
- Primary user can invite family/housemates
- Shared users can view plants and log care actions
- Permissions model: owner (full control) vs. contributor (log care, add notes)

---

## 3. Technical Architecture

### 3.1 Frontend
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4
- **Design language:** Modern with glassmorphism
  - Frosted glass effects (backdrop-blur, semi-transparent backgrounds)
  - Botanical color palette (greens, earthy neutrals, accent colors)
  - Gradient overlays
  - Bold, clean typography
  - Micro-interactions and smooth transitions
  - Dark mode toggle

### 3.2 Backend & Database
- **Provider:** Supabase
  - **Auth:** Supabase Auth (email/password, magic link)
  - **Database:** PostgreSQL (via Supabase)
  - **Realtime:** Supabase Realtime for sync and live updates
  - **Storage:** Supabase Storage for plant photos
- **Data sync model:** Hybrid (local-first + cloud sync)
  - **Local:** IndexedDB (via Dexie.js or similar) for offline data
  - **Cloud:** Supabase as remote source of truth
  - **Sync:** Background sync when connectivity is restored
  - **Conflict resolution:** Last-write-wins with timestamps

### 3.3 PWA / Offline
- **Service worker:** Custom or Workbox for caching strategies
- **Offline capability:** Full CRUD on plants and care logs while offline
- **Sync queue:** Deferred mutations synced when online
- **Push notifications:** Via Service Worker Push API + Supabase or a dedicated push service

### 3.4 QR Code Generation
- **Library:** `qrcode` or `qrcode.react` for generation
- **Encoding:** Short plant slug (e.g. `monstera-1`) → app route `/plant/monstera-1`
- **Printing:** Canvas-based printable sheet layout (cutter-guide grid)

### 3.5 Deployment
- **Hosting:** Vercel
- **Environments:** Production + Preview (auto-deployed from git)

### 3.6 Testing
- Unit tests for data layer and utilities
- E2E tests for critical flows (add plant, log care, QR scan)

---

## 4. Database Schema (Postgres / Supabase)

### 4.1 Tables

**`profiles`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK, references auth.users |
| display_name | `text` | |
| avatar_url | `text` | Nullable |
| created_at | `timestamptz` | |

**`plants`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| owner_id | `uuid` | FK → profiles.id |
| slug | `text` | Unique, short plant name + ID |
| common_name | `text` | |
| scientific_name | `text` | Nullable |
| nickname | `text` | Nullable |
| species | `text` | Nullable |
| location | `text` | Nullable |
| adopted_at | `date` | Nullable |
| light_requirement | `enum` | direct_sun / bright_indirect / low_light / shade |
| min_temp | `numeric` | Nullable |
| max_temp | `numeric` | Nullable |
| humidity_min | `integer` | Nullable, percentage |
| notes | `text` | Nullable |
| created_at | `timestamptz` | |
| updated_at | `timestamptz` | |

**`plant_photos`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| plant_id | `uuid` | FK → plants.id |
| url | `text` | |
| is_primary | `boolean` | |
| uploaded_at | `timestamptz` | |

**`care_tasks`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| plant_id | `uuid` | FK → plants.id |
| task_type | `enum` | watering / fertilizing / repotting / pruning / pest_disease / propagation |
| frequency_days | `integer` | Base interval in days |
| seasonal_adjustment | `jsonb` | Seasonal multipliers, e.g. {"winter": 1.5, "summer": 0.8} |
| amount | `text` | e.g. "200ml", "1 cup", Nullable |
| notes | `text` | Task-specific instructions |
| last_done_at | `timestamptz` | Nullable; derived from latest care_log |
| next_due_at | `timestamptz` | Computed from frequency + last_done_at + seasonal adjustment |
| is_active | `boolean` | Default true |

**`care_logs`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| plant_id | `uuid` | FK → plants.id |
| task_id | `uuid` | FK → care_tasks.id, Nullable |
| task_type | `enum` | Denormalized for quick queries |
| logged_by | `uuid` | FK → profiles.id |
| logged_at | `timestamptz` | When care was performed |
| notes | `text` | Optional observation |
| created_at | `timestamptz` | |

**`growth_records`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| plant_id | `uuid` | FK → plants.id |
| recorded_at | `date` | |
| height_cm | `numeric` | Nullable |
| leaf_count | `integer` | Nullable |
| notes | `text` | Nullable |

**`journal_entries`**
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| plant_id | `uuid` | FK → plants.id |
| author_id | `uuid` | FK → profiles.id |
| content | `text` | |
| created_at | `timestamptz` | |

**`plant_shares`** (multi-user)
| Column | Type | Notes |
|--------|------|-------|
| id | `uuid` | PK |
| plant_id | `uuid` | FK → plants.id |
| shared_with | `uuid` | FK → profiles.id |
| permission | `enum` | view / contribute |
| created_at | `timestamptz` | |

---

## 5. UI Routes / Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Overview of all plants, upcoming care tasks, recent activity |
| `/plants` | Plant List | Grid/list view of all plants with search & filter |
| `/plants/new` | Add Plant | Form to create a new plant entry |
| `/plant/[slug]` | Plant Detail | Full plant profile with care schedule, journal, growth, QR code |
| `/plant/[slug]/edit` | Edit Plant | Edit plant info |
| `/plant/[slug]/qr` | QR Code | Display QR code for this plant, print options |
| `/care` | Care Overview | Today's / this week's care tasks grouped by plant |
| `/qr-scan` | QR Scanner | In-app camera-based QR scanner for quick actions |
| `/settings` | Settings | Profile, preferences, PWA notification config, sharing management |
| `/auth/login` | Login | Supabase Auth login |
| `/auth/signup` | Sign Up | Supabase Auth sign-up |

---

## 6. Design Guidelines

### 6.1 Glassmorphism aesthetic
- Semi-transparent backgrounds with `backdrop-filter: blur()`
- Light border strokes with low opacity
- Subtle shadow depth (layered cards)
- Soft, rounded corners (12px–16px radius on cards)

### 6.2 Color palette (suggested)
- **Background:** Deep botanical green (#0a1f1a) or soft cream (#f5f0eb) depending on dark/light mode
- **Primary:** Vibrant leaf green (#2d8a4e)
- **Secondary:** Warm amber (#d4a373) for accents
- **Surface:** Glass cards with white/black at 10–20% opacity + blur
- **Text:** Near-white on dark, near-black on light

### 6.3 Typography
- **Headings:** Geist (already in project)
- **Body:** Geist Sans
- **Monospace:** Geist Mono (for data displays)

### 6.4 Transitions & micro-interactions
- Smooth page transitions (Next.js view transitions or Framer Motion)
- Hover lift effect on plant cards
- Gentle fade-ins on data load
- Checkmark animation on care task completion

---

## 7. Priorities & Phasing

### Phase 1 (MVP) — Core catalog + care tracking
- [ ] Supabase project setup (auth, database, storage)
- [ ] Plant CRUD (create, read, update, delete)
- [ ] Care task configuration per plant
- [ ] Care logging (check off tasks)
- [ ] Dashboard with upcoming tasks
- [ ] Basic PWA setup (manifest, service worker)
- [ ] Deploy to Vercel

### Phase 2 — QR codes + offline
- [ ] QR code generation (per plant)
- [ ] QR print layout
- [ ] In-app QR scanner (using camera)
- [ ] Quick action on scan (log care)
- [ ] IndexedDB local storage layer
- [ ] Offline CRUD + sync engine
- [ ] Background sync when online

### Phase 3 — Notifications + sharing
- [ ] Push notification setup (VAPID keys, service worker)
- [ ] Notification triggers for due/overdue tasks
- [ ] Multi-user sharing (invite, permissions)
- [ ] Real-time updates via Supabase Realtime

### Phase 4 — Growth tracking + polish
- [ ] Growth tracking timeline
- [ ] Journal entries
- [ ] Photo gallery per plant
- [ ] Seasonal schedule adjustments
- [ ] Glassmorphism design polish
- [ ] Dark mode / light mode toggle
- [ ] Performance optimization

---

## 8. Out of Scope (for now)
- Smart devices / IoT soil moisture sensors
- AI-powered plant disease diagnosis
- Public plant database / community features
- Multi-language support
- iOS/Android native apps (PWA is sufficient)
- Advanced analytics / reporting

---

## 9. Open Questions / Known Decisions

| Question | Decision |
|----------|----------|
| Seed data? | User will provide a list of plants later |
| QR code identifier format | Short plant name + auto-generated ID (slug) |
| Sync conflict resolution | Last-write-wins |
| Push notifications via? | Service Worker Push API (to be decided which provider sends the push) |
