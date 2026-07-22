/**
 * Turn raw OCR text into the same structured shapes the AI path returns.
 * These are best-effort, label-driven regex parsers tuned for pool-store test
 * reports (Leslie's AccuBlue) and retail receipts. OCR is noisy, so every
 * value stays optional and the user always reviews before saving — and the
 * optional AI backup check (when enabled) corrects what these miss.
 */

import type { ScannedReading, ScannedReceipt, ScannedReceiptItem } from './scanner'

/** Grab the first number that follows any of the given labels. */
function labeledNumber(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    // label ... number  (allow ppm/ppb, colons, and OCR gaps in between)
    const re = new RegExp(
      `${label}[^0-9\\n]{0,20}(\\d{1,5}(?:\\.\\d{1,2})?)`,
      'i',
    )
    const m = text.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n)) return n
    }
  }
  return undefined
}

export function parseReportText(text: string): ScannedReading {
  // Normalize common OCR confusions inside a working copy.
  const t = text.replace(/[|]/g, ' ')

  const ph = labeledNumber(t, ['ph'])
  return {
    // pH is bounded 0–14; reject stray matches like a "pH balance" score.
    ph: ph !== undefined && ph > 0 && ph <= 14 ? ph : undefined,
    fc: labeledNumber(t, ['free chlorine', 'free cl', '\\bfc\\b']),
    tc: labeledNumber(t, ['total chlorine', 'total cl', '\\btc\\b']),
    ta: labeledNumber(t, ['total alkalinity', 'alkalinity', '\\bta\\b']),
    ch: labeledNumber(t, ['calcium hardness', 'hardness', '\\bch\\b']),
    cya: labeledNumber(t, ['cyanuric', 'stabilizer', '\\bcya\\b']),
    iron: labeledNumber(t, ['iron']),
    copper: labeledNumber(t, ['copper']),
    phosphates: labeledNumber(t, ['phosphate', 'phosphates']),
    salt: labeledNumber(t, ['salt', 'sodium chloride']),
    store_score: labeledNumber(t, ['score', 'water quality']),
    gallons: labeledNumber(t, ['gallons', 'pool volume', 'volume']),
    // Product recommendations from a treatment plan are too unstructured for
    // regex; the AI backup check handles those when enabled.
    recommended_products: [],
  }
}

const MONEY_RE = /(\d{1,4}\.\d{2})/
const DATE_RE = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/

function parseDate(text: string): string | undefined {
  const m = text.match(DATE_RE)
  if (!m) return undefined
  let [, mm, dd, yy] = m
  if (yy.length === 2) yy = `20${yy}`
  const month = mm.padStart(2, '0')
  const day = dd.padStart(2, '0')
  if (Number(month) > 12 || Number(day) > 31) return undefined
  return `${yy}-${month}-${day}`
}

export function parseReceiptText(text: string): ScannedReceipt {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const store =
    lines
      .slice(0, 4)
      .find((l) => /[a-z]/i.test(l) && !MONEY_RE.test(l) && l.length > 2) ?? undefined

  const total = labeledMoney(text, ['grand total', 'total'])
  const subtotal = labeledMoney(text, ['subtotal', 'sub total'])
  const tax = labeledMoney(text, ['tax'])

  const items: ScannedReceiptItem[] = []
  for (const line of lines) {
    if (/(subtotal|sub total|total|tax|balance|change|cash|credit|visa|debit|tender)/i.test(line)) {
      continue
    }
    const money = line.match(MONEY_RE)
    if (!money) continue
    const price = Number(money[1])
    if (!Number.isFinite(price) || price <= 0) continue
    // Everything before the trailing price is the product name.
    const name = line.slice(0, money.index).replace(/\s{2,}/g, ' ').trim()
    if (name.length < 2 || !/[a-z]/i.test(name)) continue
    items.push({ product: name, qty: 1, unit_price: price })
  }

  return { store, date: parseDate(text), subtotal, tax, total, items }
}

function labeledMoney(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const re = new RegExp(`${label}[^0-9\\n]{0,12}(\\d{1,4}\\.\\d{2})`, 'i')
    const m = text.match(re)
    if (m) return Number(m[1])
  }
  return undefined
}
