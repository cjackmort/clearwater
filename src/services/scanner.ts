/**
 * Phase 2 stubs — photo scanning via the Claude vision API.
 *
 * These interfaces define the contract the UI will consume. In Phase 2 the
 * implementations will POST the photo to a small backend (or edge function)
 * that calls Claude with a structured-JSON extraction prompt and returns the
 * parsed result. Keeping the interfaces here lets Phase 1 UI ship "Scan"
 * buttons as clearly-marked stubs.
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
  phosphates?: number
  salt?: number
  recommended_products: RecommendedProduct[]
}

export interface ScannedReceiptItem {
  product: string
  qty: number
  unit_price: number
}

export interface ScannedReceipt {
  store?: string
  date?: string
  total?: number
  items: ScannedReceiptItem[]
}

export interface ReportScanner {
  /** Extract structured water-test values from a store report photo. */
  scanReport(photo: Blob): Promise<ScannedReading>
}

export interface ReceiptScanner {
  /** Extract store, date, total and line items from a receipt photo. */
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
