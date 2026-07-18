import { CATALOG } from './catalog'
import { convertAmount } from './dosing'
import type { Transaction, Treatment } from '../data/types'

/**
 * Cost prediction from usage rate.
 *
 * Preferred basis: what the owner actually added to the water (treatments in
 * the trailing 8 weeks), priced via the catalog. Fallback: trailing 90-day
 * purchase history. Both are projected to a 30-day figure.
 */

export interface SpendForecast {
  next30Days: number
  basis: 'usage' | 'purchases' | 'none'
}

const USAGE_WINDOW_DAYS = 56
const PURCHASE_WINDOW_DAYS = 90

function daysAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000
}

/** Price one treatment via the catalog; null if the product is unknown. */
function treatmentCost(t: Treatment): number | null {
  const lower = t.product.toLowerCase()
  const cat = CATALOG.find(
    (p) => p.name.toLowerCase() === lower || lower.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lower),
  )
  if (!cat) return null
  const amountInCatalogUnit = convertAmount(t.amount, t.unit, cat.unit)
  if (amountInCatalogUnit === null) return null
  return (amountInCatalogUnit / cat.packageSize) * cat.estPrice
}

export function forecastSpend(transactions: Transaction[], treatments: Treatment[]): SpendForecast {
  const recentTreatments = treatments.filter((t) => daysAgo(t.date) <= USAGE_WINDOW_DAYS)
  const usageCosts = recentTreatments
    .map(treatmentCost)
    .filter((c): c is number => c !== null)

  if (usageCosts.length > 0) {
    const monthly = (usageCosts.reduce((a, b) => a + b, 0) * 30) / USAGE_WINDOW_DAYS
    return { next30Days: Math.round(monthly * 100) / 100, basis: 'usage' }
  }

  const recentSpend = transactions
    .filter((t) => daysAgo(t.date) <= PURCHASE_WINDOW_DAYS)
    .reduce((sum, t) => sum + t.total, 0)
  if (recentSpend > 0) {
    const monthly = (recentSpend * 30) / PURCHASE_WINDOW_DAYS
    return { next30Days: Math.round(monthly * 100) / 100, basis: 'purchases' }
  }

  return { next30Days: 0, basis: 'none' }
}
