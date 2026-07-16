import { computeBuyPlan, computeDosePlan, convertAmount, type BuyPlan } from './dosing'
import { outOfRangeParams } from './healthScore'
import { PARAM_LABELS } from './dosingConstants'
import { repos } from '../data/repositories'
import {
  LOCAL_USER_ID,
  newId,
  type ChecklistItem,
  type InventoryItem,
  type Pool,
  type Reading,
} from '../data/types'

/** Standing weekly maintenance tasks included with every checklist. */
const WEEKLY_TASKS = ['Skim surface & brush walls', 'Empty skimmer & pump baskets']

/**
 * Build checklist items for a reading from its dose plan + buy plan.
 * Idempotent: returns existing items if the checklist was already generated.
 */
export async function ensureChecklistForReading(
  reading: Reading,
  pool: Pool,
  inventory: InventoryItem[],
): Promise<ChecklistItem[]> {
  const existing = await repos.checklist.forReading(reading.id)
  if (existing.length > 0) return existing

  const plan = computeBuyPlan(computeDosePlan(reading, pool), inventory)
  const items: ChecklistItem[] = []

  for (const use of plan.use) {
    items.push({
      id: newId(),
      user_id: LOCAL_USER_ID,
      reading_id: reading.id,
      action_type: 'add_chemical',
      label: `Add ${use.amount} ${use.unit} ${use.productName} — ${use.reason}`,
      product: use.productName,
      amount: use.amount,
      unit: use.unit,
      status: 'pending',
      param: use.param,
    })
  }

  for (const buy of plan.buy) {
    items.push({
      id: newId(),
      user_id: LOCAL_USER_ID,
      reading_id: reading.id,
      action_type: 'buy',
      label: `Buy ${buy.packages} × ${buy.packageUnit} ${buy.productName} (~$${buy.estCost.toFixed(2)}) — ${buy.reason}`,
      product: buy.productName,
      amount: buy.amount,
      unit: buy.unit,
      status: 'pending',
      param: buy.param,
    })
  }

  for (const task of plan.tasks) {
    items.push({
      id: newId(),
      user_id: LOCAL_USER_ID,
      reading_id: reading.id,
      action_type: 'task',
      label: task.label,
      status: 'pending',
      param: task.param,
    })
  }

  for (const label of WEEKLY_TASKS) {
    items.push({
      id: newId(),
      user_id: LOCAL_USER_ID,
      reading_id: reading.id,
      action_type: 'task',
      label,
      status: 'pending',
    })
  }

  await repos.checklist.createMany(items)
  return items
}

/**
 * Mark an item done. For add_chemical items this also writes a treatments row
 * and deducts the used amount from the matching inventory item.
 */
export async function completeChecklistItem(item: ChecklistItem, pool: Pool): Promise<void> {
  await repos.checklist.setStatus(item.id, 'done')

  if (item.action_type !== 'add_chemical' || !item.product || !item.amount || !item.unit) return

  await repos.treatments.create({
    id: newId(),
    user_id: LOCAL_USER_ID,
    pool_id: pool.id,
    date: new Date().toISOString(),
    product: item.product,
    amount: item.amount,
    unit: item.unit,
    source: 'checklist',
  })

  const inventory = await repos.inventory.forPool(pool.id)
  const productLower = item.product.toLowerCase()
  const match = inventory.find((inv) => {
    const invLower = inv.product.toLowerCase()
    return invLower === productLower || invLower.includes(productLower) || productLower.includes(invLower)
  })
  if (!match || match.quantity <= 0) return

  const amountInItemUnit = convertAmount(item.amount, item.unit, match.unit)
  // Incompatible units (e.g. tabs) → estimate a 5% draw per treatment.
  const pctUsed =
    amountInItemUnit === null ? 5 : Math.min(100, (amountInItemUnit / match.quantity) * 100)

  await repos.inventory.update({
    ...match,
    est_remaining_pct: Math.max(0, Math.round(match.est_remaining_pct - pctUsed)),
  })
}

export async function skipChecklistItem(item: ChecklistItem): Promise<void> {
  await repos.checklist.setStatus(item.id, 'skipped')
}

export interface SkipCallout {
  param: string
  label: string
  message: string
}

/**
 * "Gentle callout" logic: if a parameter is still out of range in the latest
 * reading AND the matching action on the previous reading's checklist was
 * skipped, surface it.
 */
export async function findSkipCallouts(
  readings: Reading[],
  pool: Pool,
): Promise<SkipCallout[]> {
  if (readings.length < 2) return []
  const latest = readings[readings.length - 1]
  const previous = readings[readings.length - 2]
  const stillOut = new Set(outOfRangeParams(latest, pool.type))
  if (stillOut.size === 0) return []

  const prevItems = await repos.checklist.forReading(previous.id)
  const callouts: SkipCallout[] = []
  const seen = new Set<string>()
  for (const item of prevItems) {
    if (item.status !== 'skipped' || !item.param || !stillOut.has(item.param)) continue
    if (seen.has(item.param)) continue
    seen.add(item.param)
    const label = PARAM_LABELS[item.param] ?? item.param
    callouts.push({
      param: item.param,
      label,
      message: `${label} is still out of range — the matching treatment was skipped last week.`,
    })
  }
  return callouts
}

export type { BuyPlan }
