/**
 * Photo scanning orchestrator.
 *
 * Free-first, no backend: every scan runs on-device OCR (ocr.ts + ocrParse.ts)
 * which costs nothing and needs no key. If the user has turned on the optional
 * AI backup check (Settings → AI Scanning), the same photo is also read by
 * their chosen provider — Google Gemini (free tier) or Anthropic Claude
 * (pay-per-scan) — using their own key, straight from the browser. The AI pass
 * fills gaps OCR missed and corrects values it misread; OCR results stand when
 * AI is off or unavailable, so scanning always works.
 *
 * Extraction prompts are modeled on real source documents: Leslie's AccuBlue
 * "Water Analysis" reports, their "Customized Treatment Plan", and receipts.
 */

import type { PreparedImage } from '../lib/image'
import { getScanConfig, aiScanReady, activeProviderKey, type ScanConfig } from '../lib/scanConfig'
import { ocrImage } from './ocr'
import { parseReportText, parseReceiptText } from './ocrParse'
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

/** Which engines produced a scan, so the UI can be honest about it. */
export interface ScanMeta {
  engine: 'ocr' | 'ai' | 'ocr+ai'
  /** True when the AI backup check actually ran on this scan */
  aiChecked: boolean
  /** Human-readable value changes the AI made to the OCR result */
  corrections: string[]
  /** Set when AI was enabled but failed (OCR result is still returned) */
  aiError?: string
}

export interface ReportScanResult {
  reading: ScannedReading
  meta: ScanMeta
}

export interface ReceiptScanResult {
  receipt: ScannedReceipt
  meta: ScanMeta
}

/** User-presentable scan failure. */
export class ScanError extends Error {}

// ---------------------------------------------------------------------------
// AI provider calls (Gemini / Anthropic) — return raw model text.
// ---------------------------------------------------------------------------

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_MODEL = 'claude-sonnet-5'
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

async function callAnthropicVision(
  base64: string,
  mediaType: string,
  prompt: string,
  key: string,
): Promise<string> {
  const res = await fetchOrThrow(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      // Required for browser-side calls; the key is the user's own and never
      // leaves their device except to Anthropic directly.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
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
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  return data.content?.find((b) => b.type === 'text')?.text ?? ''
}

async function callGeminiVision(
  base64: string,
  mediaType: string,
  prompt: string,
  key: string,
): Promise<string> {
  // Key goes in a header (x-goog-api-key), never the URL/query string.
  const res = await fetchOrThrow(GEMINI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
    }),
  })
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const parts = data.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => p.text ?? '').join('')
}

async function fetchOrThrow(url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ScanError('Network error — check your connection and try again.')
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new ScanError('API key rejected — double-check it in Settings.')
    if (res.status === 429) throw new ScanError('AI rate limited — wait a minute and try again.')
    if (res.status === 400) throw new ScanError('The photo could not be processed — try a clearer shot.')
    throw new ScanError(`AI scan failed (HTTP ${res.status}) — try again.`)
  }
  return res
}

function aiVision(
  base64: string,
  mediaType: string,
  prompt: string,
  config: ScanConfig,
): Promise<string> {
  const key = activeProviderKey(config)
  return config.provider === 'anthropic'
    ? callAnthropicVision(base64, mediaType, prompt, key)
    : callGeminiVision(base64, mediaType, prompt, key)
}

function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new ScanError('The AI could not read the photo — retake it with better lighting.')
  try {
    return JSON.parse(match[0]) as T
  } catch {
    throw new ScanError('The AI could not read the photo — retake it with better lighting.')
  }
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

// ---------------------------------------------------------------------------
// Prompts (shared by both AI providers)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// AI parsing (raw text -> structured), shared shape with OCR output.
// ---------------------------------------------------------------------------

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

function aiReportFromText(text: string): ScannedReading {
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
}

interface RawReceipt {
  store?: unknown
  date?: unknown
  subtotal?: unknown
  tax?: unknown
  total?: unknown
  items?: unknown
}

function aiReceiptFromText(text: string): ScannedReceipt {
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
}

// ---------------------------------------------------------------------------
// Merge helpers — AI acts as the checker: it wins conflicts, OCR fills the
// rest. Genuine value changes are recorded so the UI can show what changed.
// ---------------------------------------------------------------------------

const REPORT_LABELS: Record<string, string> = {
  fc: 'Free Chlorine',
  tc: 'Total Chlorine',
  ph: 'pH',
  ta: 'Total Alkalinity',
  ch: 'Calcium Hardness',
  cya: 'CYA',
  iron: 'Iron',
  copper: 'Copper',
  phosphates: 'Phosphates',
  salt: 'Salt',
  store_score: 'Score',
  gallons: 'Gallons',
}

type NumKey =
  | 'fc' | 'tc' | 'ph' | 'ta' | 'ch' | 'cya'
  | 'iron' | 'copper' | 'phosphates' | 'salt' | 'store_score' | 'gallons'

const REPORT_NUM_KEYS: NumKey[] = [
  'fc', 'tc', 'ph', 'ta', 'ch', 'cya', 'iron', 'copper', 'phosphates', 'salt', 'store_score', 'gallons',
]

function mergeReport(ocr: ScannedReading, ai: ScannedReading, corrections: string[]): ScannedReading {
  const out: ScannedReading = { recommended_products: ai.recommended_products }
  for (const key of REPORT_NUM_KEYS) {
    const o = ocr[key]
    const a = ai[key]
    if (a !== undefined && o !== undefined && a !== o) {
      corrections.push(`${REPORT_LABELS[key]} ${o} → ${a}`)
    }
    out[key] = a ?? o
  }
  out.date = ai.date ?? ocr.date
  return out
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scanReport(img: PreparedImage): Promise<ReportScanResult> {
  const config = getScanConfig()
  const corrections: string[] = []

  const ocr = await runOcr(img.dataUrl, parseReportText)

  if (!aiScanReady(config)) {
    return { reading: requireReading(ocr), meta: { engine: 'ocr', aiChecked: false, corrections } }
  }

  try {
    const ai = aiReportFromText(await aiVision(img.base64, img.mediaType, REPORT_PROMPT, config))
    const reading = ocr ? mergeReport(ocr, ai, corrections) : ai
    return { reading, meta: { engine: ocr ? 'ocr+ai' : 'ai', aiChecked: true, corrections } }
  } catch (err) {
    // AI failed — keep the free OCR result and report the problem.
    return {
      reading: requireReading(ocr),
      meta: {
        engine: 'ocr',
        aiChecked: false,
        corrections,
        aiError: err instanceof ScanError ? err.message : 'AI check failed — using on-device result.',
      },
    }
  }
}

export async function scanReceipt(img: PreparedImage): Promise<ReceiptScanResult> {
  const config = getScanConfig()

  const ocr = await runOcr(img.dataUrl, parseReceiptText)

  if (!aiScanReady(config)) {
    return { receipt: requireReceipt(ocr), meta: { engine: 'ocr', aiChecked: false, corrections: [] } }
  }

  try {
    const ai = aiReceiptFromText(await aiVision(img.base64, img.mediaType, RECEIPT_PROMPT, config))
    // For receipts the AI line-item extraction is far more reliable than
    // regex, so when it runs we take its structured result outright.
    return { receipt: ai, meta: { engine: ocr ? 'ocr+ai' : 'ai', aiChecked: true, corrections: [] } }
  } catch (err) {
    return {
      receipt: requireReceipt(ocr),
      meta: {
        engine: 'ocr',
        aiChecked: false,
        corrections: [],
        aiError: err instanceof ScanError ? err.message : 'AI check failed — using on-device result.',
      },
    }
  }
}

/** Run OCR, tolerating failure (returns null so an AI-only path can proceed). */
async function runOcr<T>(dataUrl: string, parse: (text: string) => T): Promise<T | null> {
  try {
    return parse(await ocrImage(dataUrl))
  } catch {
    return null
  }
}

function requireReading(reading: ScannedReading | null): ScannedReading {
  if (!reading) throw new ScanError('Could not read the photo — retake it with better lighting.')
  return reading
}

function requireReceipt(receipt: ScannedReceipt | null): ScannedReceipt {
  if (!receipt) throw new ScanError('Could not read the photo — retake it with better lighting.')
  return receipt
}
