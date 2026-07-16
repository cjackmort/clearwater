/**
 * Phase 2 stubs — photo scanning via the Claude vision API.
 *
 * These interfaces define the contract the UI will consume. In Phase 2 the
 * implementations will send the photo to Claude with a structured-JSON
 * extraction prompt and return the parsed result.
 *
 * The shapes below are modeled on real source documents:
 *
 * 1. Leslie's "Water Analysis" (AccuBlue) report — one page with a results
 *    table (TEST / IDEAL RANGE / RESULT): Free Chlorine, Total Chlorine, pH,
 *    Total Alkalinity, Calcium Hardness, Cyanuric Acid, Iron, Copper,
 *    Phosphates, Salt — plus pool details (gallons, salt vs chlorine,
 *    surface) and a 0–100% "Water Test Quality Score".
 * 2. Leslie's "Customized Treatment Plan" — follow-up pages of numbered steps,
 *    each naming a problem ("High Total Alkalinity") and product doses
 *    ("1 Gal 78 Fl oz of Muriatic Acid OR 17 lbs 1 oz of Dry Acid") →
 *    these map to `recommended_products`.
 * 3. Retail receipts — line items with item name, qty, unit price, line
 *    amount, discount lines, subtotal/tax/total.
 */

import type { RecommendedProduct } from '../data/types'

export interface ScannedReading {
  date?: string
  fc?: number
  tc?: number
  ph?: number
  ta?: number
  ch?: number
  cya?: number
  iron?: number
  copper?: number
  phosphates?: number
  salt?: number
  /** The store's own 0–100 quality score, if printed on the report */
  store_score?: number
  /** Pool volume printed on the report, useful to cross-check the profile */
  gallons?: number
  recommended_products: RecommendedProduct[]
}

export interface ScannedReceiptItem {
  product: string
  qty: number
  unit_price: number
  /** Per-line discount (negative adjustments like "$34.99 EA 2+" promos) */
  discount?: number
}

export interface ScannedReceipt {
  store?: string
  date?: string
  subtotal?: number
  tax?: number
  total?: number
  items: ScannedReceiptItem[]
}

export interface ReportScanner {
  /** Extract structured water-test values from a store report photo. */
  scanReport(photo: Blob): Promise<ScannedReading>
}

export interface ReceiptScanner {
  /** Extract store, date, totals and line items from a receipt photo. */
  scanReceipt(photo: Blob): Promise<ScannedReceipt>
}

// TODO(Phase 2): implement with Claude vision API structured JSON extraction.
export const reportScanner: ReportScanner = {
  async scanReport() {
    throw new Error('Report scanning arrives in Phase 2.')
  },
}

// TODO(Phase 2): implement with Claude vision API structured JSON extraction.
export const receiptScanner: ReceiptScanner = {
  async scanReceipt() {
    throw new Error('Receipt scanning arrives in Phase 2.')
  },
}
