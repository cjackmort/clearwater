import { catalogById, type CatalogProduct } from './catalog'
import { DOSING, IDEAL, PER_GALLONS, TARGET } from './dosingConstants'
import type { InventoryItem, Pool, Reading } from '../data/types'

/** One chemical action computed from the latest reading. */
export interface DoseAction {
  productId: string
  productName: string
  amount: number
  unit: string
  /** Human explanation, e.g. "Raise FC from 0.5 to 3 ppm" */
  reason: string
  /** Reading parameter this addresses */
  param: string
}

/** A non-chemical recommendation (aeration, dilution, brushing…). */
export interface TaskAction {
  label: string
  param: string
}

export interface DosePlan {
  doses: DoseAction[]
  tasks: TaskAction[]
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp

/**
 * Compute chemical doses from the latest reading using the documented
 * constants in dosingConstants.ts. All constants are per 10,000 gallons.
 */
export function computeDosePlan(reading: Reading, pool: Pool): DosePlan {
  const factor = pool.gallons / PER_GALLONS
  const doses: DoseAction[] = []
  const tasks: TaskAction[] = []

  const cc = Math.max(0, reading.tc - reading.fc)

  // Combined chloramines high → shock takes priority over a normal FC top-up.
  if (cc > IDEAL.cc.max) {
    const raise = Math.max(DOSING.SHOCK_TARGET_FC_PPM - reading.fc, 1)
    doses.push({
      productId: 'cal_hypo_shock',
      productName: 'Cal-Hypo Shock 65%',
      amount: round(raise * DOSING.FC_RAISE_CAL_HYPO_OZ_PER_PPM * factor),
      unit: 'oz',
      reason: `Combined chloramines at ${round(cc, 2)} ppm — shock to ${DOSING.SHOCK_TARGET_FC_PPM} ppm FC`,
      param: 'cc',
    })
  } else if (reading.fc < IDEAL.fc.min) {
    const raise = TARGET.fc - reading.fc
    doses.push({
      productId: 'liquid_chlorine',
      productName: 'Liquid Chlorine 12.5%',
      amount: round(raise * DOSING.FC_RAISE_LIQUID_FLOZ_PER_PPM * factor),
      unit: 'fl oz',
      reason: `Raise FC from ${reading.fc} to ${TARGET.fc} ppm`,
      param: 'fc',
    })
  } else if (reading.fc > IDEAL.fc.max) {
    tasks.push({
      label: `FC is high (${reading.fc} ppm) — hold off on chlorine and let sunlight burn it down`,
      param: 'fc',
    })
  }

  if (reading.ph > IDEAL.ph.max) {
    const tenths = (reading.ph - TARGET.ph) * 10
    doses.push({
      productId: 'muriatic_acid',
      productName: 'Muriatic Acid 31.45%',
      amount: round(tenths * DOSING.PH_LOWER_ACID_FLOZ_PER_TENTH * factor),
      unit: 'fl oz',
      reason: `Lower pH from ${reading.ph} to ${TARGET.ph}`,
      param: 'ph',
    })
  } else if (reading.ph < IDEAL.ph.min) {
    const tenths = (TARGET.ph - reading.ph) * 10
    doses.push({
      productId: 'soda_ash',
      productName: 'Soda Ash (pH Up)',
      amount: round(tenths * DOSING.PH_RAISE_SODA_ASH_OZ_PER_TENTH * factor),
      unit: 'oz',
      reason: `Raise pH from ${reading.ph} to ${TARGET.ph}`,
      param: 'ph',
    })
  }

  if (reading.ta < IDEAL.ta.min) {
    const steps = (TARGET.ta - reading.ta) / 10
    doses.push({
      productId: 'baking_soda',
      productName: 'Baking Soda (Alkalinity Up)',
      amount: round(steps * DOSING.TA_RAISE_BAKING_SODA_LB_PER_10PPM * factor),
      unit: 'lb',
      reason: `Raise TA from ${reading.ta} to ${TARGET.ta} ppm`,
      param: 'ta',
    })
  } else if (reading.ta > IDEAL.ta.max) {
    tasks.push({
      label: `TA is high (${reading.ta} ppm) — lower gradually with muriatic acid + aeration`,
      param: 'ta',
    })
  }

  if (reading.ch < IDEAL.ch.min) {
    const steps = (TARGET.ch - reading.ch) / 10
    doses.push({
      productId: 'calcium_chloride',
      productName: 'Calcium Chloride',
      amount: round(steps * DOSING.CH_RAISE_CACL_LB_PER_10PPM * factor),
      unit: 'lb',
      reason: `Raise CH from ${reading.ch} to ${TARGET.ch} ppm`,
      param: 'ch',
    })
  } else if (reading.ch > IDEAL.ch.max) {
    tasks.push({
      label: `Calcium hardness is high (${reading.ch} ppm) — partial drain & refill is the only fix`,
      param: 'ch',
    })
  }

  if (reading.cya < IDEAL.cya.min) {
    const steps = (TARGET.cya - reading.cya) / 10
    doses.push({
      productId: 'cya_stabilizer',
      productName: 'CYA Stabilizer',
      amount: round(steps * DOSING.CYA_RAISE_OZ_PER_10PPM * factor),
      unit: 'oz',
      reason: `Raise CYA from ${reading.cya} to ${TARGET.cya} ppm`,
      param: 'cya',
    })
  } else if (reading.cya > IDEAL.cya.max) {
    tasks.push({
      label: `CYA is high (${reading.cya} ppm) — dilute with a partial drain & refill`,
      param: 'cya',
    })
  }

  if (reading.phosphates > IDEAL.phosphates.max) {
    doses.push({
      productId: 'phosphate_remover',
      productName: 'Phosphate Remover',
      amount: round((reading.phosphates / 1000) * DOSING.PHOSPHATE_REMOVER_FLOZ_PER_1000PPB * factor),
      unit: 'fl oz',
      reason: `Phosphates at ${reading.phosphates} ppb — target <${IDEAL.phosphates.max} ppb`,
      param: 'phosphates',
    })
  }

  if (pool.type === 'saltwater' && reading.salt !== undefined && reading.salt < IDEAL.salt.min) {
    const steps = (TARGET.salt - reading.salt) / 100
    doses.push({
      productId: 'pool_salt',
      productName: 'Pool Salt',
      amount: round(steps * DOSING.SALT_RAISE_LB_PER_100PPM * factor),
      unit: 'lb',
      reason: `Raise salt from ${reading.salt} to ${TARGET.salt} ppm`,
      param: 'salt',
    })
  }

  return { doses, tasks }
}

// ---------------------------------------------------------------------------
// Inventory cross-check → "Use what you have" vs "Buy list"
// ---------------------------------------------------------------------------

export interface UseItem extends DoseAction {
  inventoryItemId: string
}

export interface BuyItem extends DoseAction {
  /** Packages to buy, rounded up to retail container size */
  packages: number
  packageUnit: string
  estCost: number
}

export interface BuyPlan {
  use: UseItem[]
  buy: BuyItem[]
  tasks: TaskAction[]
  estTotal: number
}

const OZ_PER_LB = 16

/** Convert an amount between compatible units; returns null if incompatible. */
export function convertAmount(amount: number, from: string, to: string): number | null {
  if (from === to) return amount
  if (from === 'oz' && to === 'lb') return amount / OZ_PER_LB
  if (from === 'lb' && to === 'oz') return amount * OZ_PER_LB
  if (from === 'fl oz' && to === 'gal') return amount / 128
  if (from === 'gal' && to === 'fl oz') return amount * 128
  return null
}

/** Estimated usable amount left for an inventory item, in the item's unit. */
export function availableAmount(item: InventoryItem): number {
  return item.quantity * (item.est_remaining_pct / 100)
}

function findInventoryMatch(
  dose: DoseAction,
  inventory: InventoryItem[],
): InventoryItem | undefined {
  const product = catalogById(dose.productId)
  const names = [dose.productName.toLowerCase(), product?.name.toLowerCase() ?? '']
  return inventory.find((item) => {
    const itemName = item.product.toLowerCase()
    return names.some((n) => n && (itemName === n || itemName.includes(n) || n.includes(itemName)))
  })
}

function toBuyItem(dose: DoseAction, shortfall: number, product?: CatalogProduct): BuyItem {
  const cat = product ?? catalogById(dose.productId)
  const perPackage = cat
    ? (convertAmount(cat.packageSize, cat.unit, dose.unit) ?? cat.packageSize)
    : shortfall
  const packages = Math.max(1, Math.ceil(shortfall / perPackage))
  return {
    ...dose,
    amount: round(shortfall),
    packages,
    packageUnit: cat?.packageUnit ?? dose.unit,
    estCost: round(packages * (cat?.estPrice ?? 0), 2),
  }
}

export function computeBuyPlan(plan: DosePlan, inventory: InventoryItem[]): BuyPlan {
  const use: UseItem[] = []
  const buy: BuyItem[] = []

  for (const dose of plan.doses) {
    const match = findInventoryMatch(dose, inventory)
    if (!match) {
      buy.push(toBuyItem(dose, dose.amount))
      continue
    }
    const availableInDoseUnit = convertAmount(availableAmount(match), match.unit, dose.unit)
    if (availableInDoseUnit === null) {
      // Units aren't comparable (e.g. tabs vs oz) — assume usable if any stock remains.
      if (match.est_remaining_pct > 10) {
        use.push({ ...dose, inventoryItemId: match.id })
      } else {
        buy.push(toBuyItem(dose, dose.amount))
      }
      continue
    }
    if (availableInDoseUnit >= dose.amount) {
      use.push({ ...dose, inventoryItemId: match.id })
    } else if (availableInDoseUnit > 0) {
      use.push({ ...dose, amount: round(availableInDoseUnit), inventoryItemId: match.id })
      buy.push(toBuyItem(dose, dose.amount - availableInDoseUnit))
    } else {
      buy.push(toBuyItem(dose, dose.amount))
    }
  }

  return {
    use,
    buy,
    tasks: plan.tasks,
    estTotal: round(
      buy.reduce((sum, b) => sum + b.estCost, 0),
      2,
    ),
  }
}
