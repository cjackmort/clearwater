import { db } from './db'
import { repos } from './repositories'
import { computeHealthScore } from '../domain/healthScore'
import { ensureChecklistForReading } from '../domain/checklist'
import {
  LOCAL_USER_ID,
  newId,
  type InventoryItem,
  type Pool,
  type Reading,
  type Transaction,
  type TransactionItem,
} from './types'

/**
 * Demo data: one 15,000 gal chlorine pool with an 8-week story — steady start,
 * algae scare in week 3 (FC crash, chloramines, phosphates spike), shock
 * recovery in week 4, then a slow return to balance. Week 7 has a skipped
 * phosphate/pH treatment so the dashboard callout has something to say.
 */

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(9, 30, 0, 0)
  return d.toISOString()
}

interface WeekValues {
  fc: number
  tc: number
  ph: number
  ta: number
  ch: number
  cya: number
  phosphates: number
}

// Index 0 is the oldest week; the last entry is the most recent reading.
const WEEKS: WeekValues[] = [
  { fc: 3.2, tc: 3.3, ph: 7.5, ta: 100, ch: 280, cya: 40, phosphates: 50 },
  { fc: 2.1, tc: 2.3, ph: 7.6, ta: 95, ch: 285, cya: 40, phosphates: 120 },
  // Week 3 — algae scare: chlorine crashed, chloramines up, phosphates spike
  { fc: 0.3, tc: 1.6, ph: 7.9, ta: 90, ch: 290, cya: 38, phosphates: 950 },
  // Week 4 — the morning after shocking the pool
  { fc: 8.5, tc: 8.8, ph: 7.3, ta: 85, ch: 295, cya: 38, phosphates: 380 },
  { fc: 4.5, tc: 4.6, ph: 7.4, ta: 88, ch: 300, cya: 39, phosphates: 210 },
  { fc: 3.6, tc: 3.7, ph: 7.5, ta: 92, ch: 300, cya: 40, phosphates: 140 },
  // Week 7 — pH and phosphates flagged; treatments get skipped this week
  { fc: 3.0, tc: 3.1, ph: 7.8, ta: 98, ch: 305, cya: 41, phosphates: 240 },
  // Week 8 (latest) — both are still out of range → gentle callout
  { fc: 2.4, tc: 2.5, ph: 7.7, ta: 105, ch: 305, cya: 42, phosphates: 160 },
]

const INVENTORY: Array<Pick<InventoryItem, 'product' | 'category' | 'quantity' | 'unit' | 'est_remaining_pct'>> = [
  { product: 'Chlorine Tabs 3"', category: 'Sanitizer', quantity: 50, unit: 'tabs', est_remaining_pct: 60 },
  { product: 'Liquid Chlorine 12.5%', category: 'Sanitizer', quantity: 256, unit: 'fl oz', est_remaining_pct: 45 },
  { product: 'Cal-Hypo Shock 65%', category: 'Shock', quantity: 48, unit: 'oz', est_remaining_pct: 70 },
  { product: 'Muriatic Acid 31.45%', category: 'Balancer', quantity: 128, unit: 'fl oz', est_remaining_pct: 55 },
  { product: 'Baking Soda (Alkalinity Up)', category: 'Balancer', quantity: 12, unit: 'lb', est_remaining_pct: 80 },
  { product: 'CYA Stabilizer', category: 'Balancer', quantity: 64, unit: 'oz', est_remaining_pct: 90 },
  { product: 'Algaecide 60%', category: 'Algae & Clarity', quantity: 32, unit: 'fl oz', est_remaining_pct: 20 },
  { product: 'Phosphate Remover', category: 'Algae & Clarity', quantity: 32, unit: 'fl oz', est_remaining_pct: 15 },
  { product: 'Filter Cartridge', category: 'Filter & Equipment', quantity: 1, unit: 'each', est_remaining_pct: 100 },
]

interface SeedTx {
  store: string
  ageDays: number
  items: Array<{ product: string; qty: number; unit_price: number }>
}

const TRANSACTIONS: SeedTx[] = [
  {
    store: "Leslie's Pool Supply",
    ageDays: 56,
    items: [
      { product: 'Chlorine Tabs 3"', qty: 1, unit_price: 89.99 },
      { product: 'Muriatic Acid 31.45%', qty: 2, unit_price: 12.99 },
    ],
  },
  {
    store: 'Home Depot',
    ageDays: 47,
    items: [{ product: 'Liquid Chlorine 12.5%', qty: 2, unit_price: 8.99 }],
  },
  {
    store: "Leslie's Pool Supply",
    ageDays: 34,
    items: [
      { product: 'Cal-Hypo Shock 65%', qty: 4, unit_price: 6.49 },
      { product: 'Algaecide 60%', qty: 1, unit_price: 17.99 },
      { product: 'Phosphate Remover', qty: 1, unit_price: 27.99 },
    ],
  },
  {
    store: 'Pinch A Penny',
    ageDays: 27,
    items: [
      { product: 'Water Clarifier', qty: 1, unit_price: 12.49 },
      { product: 'Filter Cartridge', qty: 1, unit_price: 44.99 },
    ],
  },
  {
    store: 'Amazon',
    ageDays: 13,
    items: [
      { product: 'Baking Soda (Alkalinity Up)', qty: 1, unit_price: 14.99 },
      { product: 'CYA Stabilizer', qty: 1, unit_price: 19.99 },
    ],
  },
  {
    store: 'Home Depot',
    ageDays: 3,
    items: [{ product: 'Liquid Chlorine 12.5%', qty: 3, unit_price: 8.99 }],
  },
]

/** Wipe all tables and load the demo dataset. Returns the demo pool id. */
export async function loadDemoData(): Promise<string> {
  await db.transaction(
    'rw',
    [
      db.pools,
      db.readings,
      db.inventory_items,
      db.transactions,
      db.transaction_items,
      db.treatments,
      db.checklist_items,
    ],
    async () => {
      await Promise.all(db.tables.map((t) => t.clear()))
    },
  )

  const pool: Pool = {
    id: newId(),
    user_id: LOCAL_USER_ID,
    name: 'Backyard Pool',
    gallons: 15000,
    type: 'chlorine',
    surface: 'plaster',
    created_at: daysAgo(60),
  }
  await repos.pools.create(pool)

  const readings: Reading[] = WEEKS.map((week, i) => ({
    id: newId(),
    user_id: LOCAL_USER_ID,
    pool_id: pool.id,
    date: daysAgo((WEEKS.length - 1 - i) * 7),
    ...week,
    health_score: computeHealthScore(week, pool.type),
    recommended_products:
      i === 2
        ? [
            { product: 'Cal-Hypo Shock 65%', quantity: 4, unit: 'lb', reason: 'Algae bloom — shock treatment' },
            { product: 'Algaecide 60%', quantity: 1, unit: 'qt', reason: 'Kill remaining algae' },
            { product: 'Phosphate Remover', quantity: 1, unit: 'qt', reason: 'Phosphates at 950 ppb' },
          ]
        : [],
  }))
  for (const reading of readings) await repos.readings.create(reading)

  for (const inv of INVENTORY) {
    await repos.inventory.create({
      id: newId(),
      user_id: LOCAL_USER_ID,
      pool_id: pool.id,
      ...inv,
    })
  }

  for (const tx of TRANSACTIONS) {
    const txId = newId()
    const items: TransactionItem[] = tx.items.map((item) => ({
      id: newId(),
      user_id: LOCAL_USER_ID,
      transaction_id: txId,
      ...item,
    }))
    const transaction: Transaction = {
      id: txId,
      user_id: LOCAL_USER_ID,
      pool_id: pool.id,
      store: tx.store,
      date: daysAgo(tx.ageDays),
      total: Math.round(items.reduce((sum, i) => sum + i.qty * i.unit_price, 0) * 100) / 100,
    }
    await repos.transactions.create(transaction, items)
  }

  // Treatments that tell the recovery story.
  const treatments = [
    { ageDays: 34, product: 'Cal-Hypo Shock 65%', amount: 30, unit: 'oz' },
    { ageDays: 33, product: 'Algaecide 60%', amount: 16, unit: 'fl oz' },
    { ageDays: 32, product: 'Phosphate Remover', amount: 20, unit: 'fl oz' },
    { ageDays: 20, product: 'Liquid Chlorine 12.5%', amount: 32, unit: 'fl oz' },
  ]
  for (const t of treatments) {
    await repos.treatments.create({
      id: newId(),
      user_id: LOCAL_USER_ID,
      pool_id: pool.id,
      date: daysAgo(t.ageDays),
      product: t.product,
      amount: t.amount,
      unit: t.unit,
      source: 'checklist',
    })
  }

  // Week 7 checklist: pH + phosphate treatments were skipped, the rest done —
  // powers the "still out of range" callout on the dashboard.
  const week7 = readings[readings.length - 2]
  const inventory = await repos.inventory.forPool(pool.id)
  const week7Items = await ensureChecklistForReading(week7, pool, inventory)
  for (const item of week7Items) {
    const skipped = item.param === 'ph' || item.param === 'phosphates'
    await repos.checklist.setStatus(item.id, skipped ? 'skipped' : 'done')
  }

  return pool.id
}

/** Wipe everything (used by Settings → Reset). */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })
}
