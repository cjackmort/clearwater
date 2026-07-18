/**
 * Photo scanning via the Claude API (vision + structured JSON extraction).
 *
 * The app is local-first with no backend, so these calls go straight from the
 * browser to the Anthropic API using the user's own key (Settings → AI
 * Scanning; stored only on-device). The extraction prompts are modeled on
 * real source documents: Leslie's AccuBlue "Water Analysis" reports, their
 * multi-page "Customized Treatment Plan", and retail receipts.
 */

import { getApiKey } from '../lib/apiKey'
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
  /** Per-line discount total (promos like "$34.99 EA 2+") */
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

/** User-presentable scan failure. */
export class ScanError extends Error {}

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-5'

async function callClaudeVision(base64: string, mediaType: string, prompt: string): Promise<string> {
  const key = getApiKey()
  if (!key) {
    throw new ScanError('Add your Anthropic API key in Settings → AI Scanning first.')
  }
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        // Required for browser-side calls; the key is the user's own and
        // never leaves their device except to Anthropic directly.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })
  } catch {
    throw new ScanError('Network error — check your connection and try again.')
  }
  if (!res.ok) {
    if (res.status === 401) throw new ScanError('API key rejected — double-check it in Settings.')
    if (res.status === 429) throw new ScanError('Rate limited — wait a minute and try again.')
    if (res.status === 400) throw new ScanError('The photo could not be processed — try a clearer shot.')
    throw new ScanError(`Scan failed (HTTP ${res.status}) — try again.`)
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  return data.content?.find((b) => b.type === 'text')?.text ?? ''
}

function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new ScanError('Could not read the photo — retake it with better lighting.')
  try {
    return JSON.parse(match[0]) as T
  } catch {
    throw new ScanError('Could not read the photo — retake it with better lighting.')
  }
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

const REPORT_PROMPT = `This photo shows a pool-store water test report (e.g. Leslie's AccuBlue "Water Analysis") or a page of its "Customized Treatment Plan".

Extract every value you can see and reply with ONLY a JSON object (no prose, no code fences) in exactly this shape — use null for anything not visible:

{
  "date": "YYYY-MM-DD or null (the test date)",
  "fc": null,          // Free Chlorine, ppm
  "tc": null,          // Total Chlorine, ppm
  "ph": null,
  "ta": null,          // Total Alkalinity, ppm
  "ch": null,          // Calcium Hardness, ppm
  "cya": null,         // Cyanuric Acid, ppm
  "iron": null,        // ppm
  "copper": null,      // ppm
  "phosphates": null,  // ppb
  "salt": null,        // ppm
  "store_score": null, // the report's own 0-100 quality score, number only
  "gallons": null,     // pool volume printed on the report
  "recommended_products": [
    // one entry per product dose the treatment plan tells the owner to add,
    // e.g. {"product": "Muriatic Acid", "quantity": 206, "unit": "fl oz",
    //       "reason": "High Total Alkalinity"}
    // Convert "1 Gal 78 Fl oz" style amounts to a single number in the unit
    // you state. If alternatives are offered (OR), include only the first.
  ]
}

Numbers must be plain JSON numbers (no units inside the value).`

const RECEIPT_PROMPT = `This photo shows a retail receipt (likely from a pool supply store).

Extract it and reply with ONLY a JSON object (no prose, no code fences) in exactly this shape — use null for anything not visible:

{
  "store": "store name or null",
  "date": "YYYY-MM-DD or null",
  "subtotal": null,
  "tax": null,
  "total": null,
  "items": [
    // one entry per purchased line item. Expand abbreviated names when the
    // meaning is clear (e.g. "3L NO PHOS NB" -> "No Phos 3L").
    // Discount/promo lines like "$34.99 EA 2+ ... (5.00)" belong to the item
    // above them: put the discounted amount in that item's "discount" field
    // (5.00 means $5.00 off that line), never as their own item.
    {"product": "name", "qty": 1, "unit_price": 39.99, "discount": 5.00}
  ]
}

qty and prices must be plain JSON numbers.`

export interface ReportScanner {
  scanReport(base64: string, mediaType: string): Promise<ScannedReading>
}

export interface ReceiptScanner {
  scanReceipt(base64: string, mediaType: string): Promise<ScannedReceipt>
}

interface RawReport {
  date?: unknown
  fc?: unknown
  tc?: unknown
  ph?: unknown
  ta?: unknown
  ch?: unknown
  cya?: unknown
  iron?: unknown
  copper?: unknown
  phosphates?: unknown
  salt?: unknown
  store_score?: unknown
  gallons?: unknown
  recommended_products?: unknown
}

export const reportScanner: ReportScanner = {
  async scanReport(base64, mediaType) {
    const text = await callClaudeVision(base64, mediaType, REPORT_PROMPT)
    const raw = extractJson<RawReport>(text)
    const products = Array.isArray(raw.recommended_products) ? raw.recommended_products : []
    return {
      date: typeof raw.date === 'string' ? raw.date : undefined,
      fc: num(raw.fc),
      tc: num(raw.tc),
      ph: num(raw.ph),
      ta: num(raw.ta),
      ch: num(raw.ch),
      cya: num(raw.cya),
      iron: num(raw.iron),
      copper: num(raw.copper),
      phosphates: num(raw.phosphates),
      salt: num(raw.salt),
      store_score: num(raw.store_score),
      gallons: num(raw.gallons),
      recommended_products: products
        .filter(
          (p): p is { product: string; quantity?: number; unit?: string; reason?: string } =>
            !!p && typeof (p as { product?: unknown }).product === 'string',
        )
        .map((p) => ({
          product: p.product,
          quantity: num(p.quantity) ?? 1,
          unit: typeof p.unit === 'string' ? p.unit : 'each',
          reason: typeof p.reason === 'string' ? p.reason : '',
        })),
    }
  },
}

interface RawReceipt {
  store?: unknown
  date?: unknown
  subtotal?: unknown
  tax?: unknown
  total?: unknown
  items?: unknown
}

export const receiptScanner: ReceiptScanner = {
  async scanReceipt(base64, mediaType) {
    const text = await callClaudeVision(base64, mediaType, RECEIPT_PROMPT)
    const raw = extractJson<RawReceipt>(text)
    const items = Array.isArray(raw.items) ? raw.items : []
    return {
      store: typeof raw.store === 'string' ? raw.store : undefined,
      date: typeof raw.date === 'string' ? raw.date : undefined,
      subtotal: num(raw.subtotal),
      tax: num(raw.tax),
      total: num(raw.total),
      items: items
        .filter(
          (i): i is { product: string; qty?: number; unit_price?: number; discount?: number } =>
            !!i && typeof (i as { product?: unknown }).product === 'string',
        )
        .map((i) => ({
          product: i.product,
          qty: num(i.qty) ?? 1,
          unit_price: num(i.unit_price) ?? 0,
          discount: num(i.discount),
        })),
    }
  },
}
