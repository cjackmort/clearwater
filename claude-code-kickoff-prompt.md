# PoolLedger — Claude Code Kickoff Prompt

Copy everything below the line and paste it as your first message in Claude Code (run it from an empty folder like `~/projects/poolledger`).

---

You are the lead developer on **PoolLedger**, a mobile-first PWA that helps pool owners turn water test reports into smart shopping lists and track every dollar spent on their pool. Build Phase 1 tonight, working autonomously. Make it look genuinely professional — this should feel like a polished product, not a demo.

## Tech stack
- React + Vite + TypeScript
- Tailwind CSS
- Recharts for charts
- vite-plugin-pwa so it's installable on a phone
- React Router
- **Local-first storage for now**: Dexie (IndexedDB) behind a repository layer (`src/data/`) with clean interfaces, so we can swap in Supabase later without touching UI code. Design every table with a `user_id` field (hardcode "local" for now) so multi-user auth is a config change later, not a rewrite.
- Zustand (or React context) for app state

## Data model
- `pools`: id, name, gallons, type (chlorine|saltwater), surface (plaster|vinyl|fiberglass)
- `readings`: id, pool_id, date, fc, tc, ph, ta, ch, cya, phosphates, salt, health_score, photo_url?, recommended_products (json array from the store report)
- `inventory_items`: id, pool_id, product, category, quantity, unit, est_remaining_pct
- `transactions`: id, pool_id, store, date, total, receipt_photo_url?
- `transaction_items`: id, transaction_id, product, qty, unit_price
- `treatments`: id, pool_id, date, product, amount, unit, source (checklist|manual)
- `checklist_items`: id, reading_id, action_type (add_chemical|buy|task), label, product?, amount?, unit?, status (pending|done|skipped)

## Phase 1 features (build all of these tonight)

1. **Onboarding / Pool Profile** — create a pool with name, type, surface, and a gallons calculator (rectangle: L×W×avg depth×7.5; round: diameter²×avg depth×5.9; oval: L×W×avg depth×5.9), or direct gallon entry.

2. **Inventory** — CRUD for chemicals on hand. Pre-load a product catalog (chlorine tabs 3", liquid chlorine, cal-hypo shock, dichlor shock, muriatic acid, soda ash/pH up, sodium bisulfate/pH down, baking soda/alkalinity up, calcium chloride, CYA stabilizer, algaecide, clarifier, phosphate remover, DE powder, filter cartridges, pool salt) with categories and default units. Quantity + estimated % remaining per item. Low-stock badge under 25%.

3. **Manual reading entry** — form for FC, TC, pH, TA, CH, CYA, phosphates (and salt if saltwater pool). Compute a composite **Pool Health Score (0–100)**: weight each parameter by distance from ideal range (FC 1–4 ppm, pH 7.4–7.6, TA 80–120, CH 200–400, CYA 30–50, phosphates <100 ppb, combined chloramine = TC−FC should be <0.2). Show the score with a color ring (red <60, yellow 60–84, green 85+).

4. **Dosing calculator + Smart Buy List** — from the latest reading and pool gallons, compute needed chemical amounts using standard dosing math (e.g., raise FC 1 ppm per 10k gal ≈ 2 oz cal-hypo 65%; lower pH from 7.9→7.5 per 10k gal ≈ 12 oz muriatic acid 31.45%; raise TA 10 ppm per 10k gal ≈ 1.4 lbs baking soda; raise CYA 10 ppm per 10k gal ≈ 13 oz stabilizer — include a documented constants file so we can tune these). Cross-check against inventory: split output into "Use what you have" vs "Buy list" with estimated quantities.

5. **Weekly Action Checklist** — auto-generate from the latest reading + buy list: one card per action, each with ✓ / ✗ buttons. ✓ on an add-chemical item writes a `treatments` row and deducts from inventory. ✗ marks skipped and is retained. Progress bar on dashboard. If a parameter is still out of range and the matching action was skipped last week, show a gentle callout ("Phosphates still high — treatment was skipped last week").

6. **Dashboard** — the home screen. Health score ring, this week's checklist progress, sparkline trends for pH/FC/TA, low-stock alerts, latest buy list total estimate. Professional, data-dense but clean.

7. **Trends page** — Recharts line charts per parameter over time with shaded ideal-range bands, plus the health score trend.

8. **Ledger (manual entry for now)** — add transactions with line items; monthly spend summary with a bar chart by month and a category breakdown. Receipt photo scanning comes in Phase 2 — leave a clearly marked stub.

## Design direction
- Mobile-first (375px), works up to desktop
- Palette: deep navy background option aside, default to a light theme with white cards, a strong blue-teal primary (#0891b2 range), generous whitespace, rounded-2xl cards, subtle shadows
- Inter or system font stack; big clear numbers for scores and dollar amounts
- Bottom tab bar on mobile: Home, Trends, Checklist, Inventory, Ledger
- Empty states with helpful copy, not blank screens

## Seed data
Include a "Load demo data" button (settings page) that seeds: one 15,000 gal chlorine pool, 8 weeks of readings with a realistic story (algae scare in week 3, recovery after shock), a stocked inventory, and 6 transactions. This makes every screen come alive instantly for testing.

## Phase 2 (stub, don't build yet)
- Diagnostic report photo scanner and receipt scanner via Claude vision API (structured JSON extraction) — create the service interfaces and TODO comments
- Cost prediction from usage rate
- Supabase swap + auth

## Working style
- Initialize git, commit in logical chunks
- Get `npm run dev` working early and keep it working
- After building, run the app, verify each screen renders with demo data, and fix anything broken before finishing
- Finish with a README covering setup, architecture, and the Phase 2 roadmap
