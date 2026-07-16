# PoolLedger

A mobile-first PWA that turns pool water test reports into smart shopping lists — and tracks every dollar spent on your pool.

**Phase 1** is local-first: all data lives in your browser (IndexedDB), no account needed, installable on your phone.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build (dist/)
npm run preview  # serve the production build
```

Open Settings → **Load demo data** to fill every screen instantly: a 15,000-gallon chlorine pool with 8 weeks of readings (including an algae scare in week 3 and shock recovery), a stocked inventory, and 6 purchases.

## Features

- **Onboarding** — pool profile with a gallons calculator (rectangle / round / oval) or direct entry
- **Pool Health Score (0–100)** — each parameter weighted by distance from its ideal range (FC 1–4 ppm, pH 7.4–7.6, TA 80–120, CH 200–400, CYA 30–50, phosphates <100 ppb, combined chloramines <0.2); color ring: red <60, yellow 60–84, green 85+
- **Dosing calculator + Smart Buy List** — standard dosing math from your latest reading and pool volume, cross-checked against inventory and split into *Use what you have* vs *Buy list* with package counts and estimated cost
- **Weekly Action Checklist** — auto-generated per reading; ✓ on a chemical logs a treatment and deducts inventory, ✗ retains the skip; if a parameter is still out of range the next week, the dashboard shows a gentle callout
- **Inventory** — pre-loaded 16-product catalog, quantity + estimated % remaining, low-stock badge under 25%
- **Trends** — per-parameter charts with shaded ideal-range bands, plus the health score trend
- **Ledger** — purchases with line items, monthly spend bar chart, category breakdown
- **PWA** — installable, works offline once loaded

## Architecture

```
src/
  data/
    types.ts          # Entities — every table has user_id ("local" for now)
    db.ts             # Dexie (IndexedDB) schema — only repositories.ts touches it
    repositories.ts   # Repository interfaces + Dexie implementations
    seed.ts           # Demo data (8-week story)
  domain/             # Pure logic, no storage or UI dependencies
    dosingConstants.ts# ⭐ Tunable dosing math constants + ideal ranges (documented)
    dosing.ts         # Dose plan → inventory cross-check → buy plan
    healthScore.ts    # Weighted composite score
    checklist.ts      # Checklist generation + completion side effects
    catalog.ts        # Pre-loaded product catalog with package sizes & prices
  services/
    scanner.ts        # Phase 2 stubs: report & receipt scanning interfaces
  store/useAppStore.ts# Zustand — active pool only; data reads use useLiveQuery
  pages/              # One file per screen
  components/         # Layout (bottom tab bar), HealthRing, Sparkline, etc.
```

**Key decisions**

- **Repository layer**: UI code never imports Dexie. Swapping to Supabase means writing a second set of repository implementations behind the same interfaces — plus flipping `user_id` from the hardcoded `"local"` to the authenticated user.
- **Live queries**: `dexie-react-hooks`' `useLiveQuery` makes every screen react to writes anywhere in the app (checking off a chemical instantly updates the dashboard progress bar and inventory).
- **Dosing constants** live in one documented file (`src/domain/dosingConstants.ts`) — all amounts are *per 10,000 gallons per step*, sourced from standard industry dosing charts, and easy to tune.

## Phase 2 roadmap

- **Report photo scanner** — snap the pool-store test report; Claude vision API extracts structured JSON into a reading (interface ready in `src/services/scanner.ts`)
- **Receipt scanner** — same pipeline into the ledger (`ReceiptScanner` interface stubbed)
- **Cost prediction** — forecast spend from chemical usage rate
- **Supabase swap + auth** — implement the repository interfaces against Postgres; `user_id` columns are already on every table

## Stack

React 18 · Vite 6 · TypeScript · Tailwind CSS 4 · Recharts · Dexie 4 · Zustand · React Router · vite-plugin-pwa
