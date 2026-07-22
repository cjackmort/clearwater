import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { prepareImage } from '../lib/image'
import { scanReport, ScanError, type ScanMeta } from '../services/scanner'
import { HealthRing } from '../components/HealthRing'
import { CameraIcon } from '../components/Icons'
import { computeHealthScore } from '../domain/healthScore'
import { computeBuyPlan, computeDosePlan } from '../domain/dosing'
import { ensureChecklistForReading } from '../domain/checklist'
import { IDEAL } from '../domain/dosingConstants'
import { LOCAL_USER_ID, newId, type Reading, type RecommendedProduct } from '../data/types'

type FieldStatus = 'low' | 'good' | 'high' | null

function fieldStatus(key: string, raw: string): FieldStatus {
  const range = IDEAL[key]
  if (!range || raw === '' || raw === undefined) return null
  const v = Number(raw)
  if (Number.isNaN(v)) return null
  if (v < range.min) return 'low'
  if (v > range.max) return 'high'
  return 'good'
}

const STATUS_CHIP: Record<'low' | 'good' | 'high', string> = {
  good: 'bg-emerald-100 text-emerald-700',
  low: 'bg-sky-100 text-sky-700',
  high: 'bg-amber-100 text-amber-700',
}
const STATUS_TEXT: Record<'low' | 'good' | 'high', string> = {
  good: 'Good',
  low: 'Low ↓',
  high: 'High ↑',
}

interface Field {
  key: 'fc' | 'tc' | 'ph' | 'ta' | 'ch' | 'cya' | 'phosphates' | 'salt'
  label: string
  unit: string
  placeholder: string
  step: string
}

const FIELDS: Field[] = [
  { key: 'fc', label: 'Free Chlorine', unit: 'ppm', placeholder: '3.0', step: '0.1' },
  { key: 'tc', label: 'Total Chlorine', unit: 'ppm', placeholder: '3.2', step: '0.1' },
  { key: 'ph', label: 'pH', unit: '', placeholder: '7.5', step: '0.1' },
  { key: 'ta', label: 'Total Alkalinity', unit: 'ppm', placeholder: '100', step: '1' },
  { key: 'ch', label: 'Calcium Hardness', unit: 'ppm', placeholder: '300', step: '10' },
  { key: 'cya', label: 'CYA (Stabilizer)', unit: 'ppm', placeholder: '40', step: '1' },
  { key: 'phosphates', label: 'Phosphates', unit: 'ppb', placeholder: '50', step: '10' },
]

const SALT_FIELD: Field = { key: 'salt', label: 'Salt', unit: 'ppm', placeholder: '3200', step: '100' }

export function ReadingNew() {
  const navigate = useNavigate()
  const pool = useActivePool()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null)
  const [scannedPhotoUrl, setScannedPhotoUrl] = useState<string | null>(null)
  const [scannedProducts, setScannedProducts] = useState<RecommendedProduct[]>([])
  const [scannedGallons, setScannedGallons] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fields = useMemo(
    () => (pool?.type === 'saltwater' ? [...FIELDS, SALT_FIELD] : FIELDS),
    [pool?.type],
  )

  const parsed = useMemo(() => {
    const out: Record<string, number> = {}
    for (const f of fields) {
      const n = Number(values[f.key])
      if (values[f.key] !== undefined && values[f.key] !== '' && !Number.isNaN(n)) out[f.key] = n
    }
    return out
  }, [values, fields])

  const requiredKeys = FIELDS.map((f) => f.key)
  const complete = requiredKeys.every((k) => parsed[k] !== undefined)

  const previewScore = useMemo(() => {
    if (!pool || !complete) return null
    return computeHealthScore(
      {
        fc: parsed.fc,
        tc: parsed.tc,
        ph: parsed.ph,
        ta: parsed.ta,
        ch: parsed.ch,
        cya: parsed.cya,
        phosphates: parsed.phosphates,
        salt: parsed.salt,
      },
      pool.type,
    )
  }, [pool, parsed, complete])

  if (!pool) return null

  const gallonsMismatch =
    scannedGallons !== null && Math.abs(scannedGallons - pool.gallons) / pool.gallons > 0.1

  function startScan() {
    if (scanning) return
    fileInputRef.current?.click()
  }

  async function scanFile(file: File) {
    setScanning(true)
    setScanError('')
    setScanMeta(null)
    try {
      const img = await prepareImage(file)
      const { reading: scan, meta } = await scanReport(img)
      const filled: Record<string, string> = {}
      for (const key of ['fc', 'tc', 'ph', 'ta', 'ch', 'cya', 'phosphates', 'salt'] as const) {
        const value = scan[key]
        if (value !== undefined) filled[key] = String(value)
      }
      setValues((v) => ({ ...v, ...filled }))
      setScannedPhotoUrl(img.dataUrl)
      setScannedProducts(scan.recommended_products)
      setScannedGallons(scan.gallons ?? null)
      setScanMeta(meta)
    } catch (err) {
      setScanError(err instanceof ScanError ? err.message : 'Scan failed — try again.')
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function save() {
    if (!pool || !complete || saving) return
    setSaving(true)

    const reading: Reading = {
      id: newId(),
      user_id: LOCAL_USER_ID,
      pool_id: pool.id,
      date: new Date().toISOString(),
      fc: parsed.fc,
      tc: parsed.tc,
      ph: parsed.ph,
      ta: parsed.ta,
      ch: parsed.ch,
      cya: parsed.cya,
      phosphates: parsed.phosphates,
      salt: parsed.salt,
      health_score: previewScore ?? 0,
      recommended_products: [],
    }

    if (scannedPhotoUrl) reading.photo_url = scannedPhotoUrl

    const inventory = await repos.inventory.forPool(pool.id)
    if (scannedProducts.length > 0) {
      // The store's own treatment plan takes priority over our computed list.
      reading.recommended_products = scannedProducts
    } else {
      // Store the computed buy list on the reading (mirrors what a scanned
      // store report provides).
      const buyPlan = computeBuyPlan(computeDosePlan(reading, pool), inventory)
      reading.recommended_products = buyPlan.buy.map((b) => ({
        product: b.productName,
        quantity: b.packages,
        unit: b.packageUnit,
        reason: b.reason,
      }))
    }

    await repos.readings.create(reading)
    await ensureChecklistForReading(reading, pool, inventory)
    navigate('/checklist')
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void scanFile(file)
        }}
      />
      <button
        type="button"
        disabled={scanning}
        className="group flex w-full items-center gap-3 rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-sky-50 px-4 py-3.5 text-left transition hover:from-cyan-100 hover:to-sky-100 active:scale-[0.99] disabled:opacity-60"
        onClick={startScan}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 text-white shadow-sm shadow-cyan-500/30">
          <CameraIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-cyan-900">
            {scanning ? 'Reading your report…' : 'Scan a store test report'}
          </span>
          <span className="block text-xs text-cyan-700/70">
            {scanning ? 'Extracting your numbers' : 'Free on-device · auto-fills every field'}
          </span>
        </span>
      </button>

      {scanError && (
        <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {scanError}
        </div>
      )}

      {scanMeta && (
        <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          <p>
            {scanMeta.aiChecked
              ? 'Scanned on-device and AI-verified'
              : 'Scanned on-device (free)'}{' '}
            — review the values below, then save.
          </p>
          {scanMeta.corrections.length > 0 && (
            <p className="mt-1 text-emerald-600">
              AI corrected: {scanMeta.corrections.join(', ')}.
            </p>
          )}
          {scanMeta.aiError && (
            <p className="mt-1 text-amber-600">{scanMeta.aiError}</p>
          )}
        </div>
      )}

      {gallonsMismatch && scannedGallons !== null && (
        <div className="rounded-2xl bg-cyan-50 p-3 text-sm text-cyan-800 ring-1 ring-cyan-200">
          The report says {scannedGallons.toLocaleString()} gal but your profile says{' '}
          {pool.gallons.toLocaleString()} gal — dosing uses your profile.
        </div>
      )}

      <section className="card">
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Test results</h2>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => {
            const status = fieldStatus(f.key, values[f.key] ?? '')
            return (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between gap-1">
                  <label
                    className="text-xs font-semibold tracking-wide text-slate-500 uppercase"
                    htmlFor={`reading-${f.key}`}
                  >
                    {f.label} {f.unit && <span className="text-slate-300">({f.unit})</span>}
                  </label>
                  {status && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_CHIP[status]}`}
                    >
                      {STATUS_TEXT[status]}
                    </span>
                  )}
                </div>
                <input
                  id={`reading-${f.key}`}
                  className="input-base tabular-nums"
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            )
          })}
        </div>
      </section>

      <section className="card flex items-center gap-5">
        {previewScore !== null ? (
          <>
            <HealthRing score={previewScore} size={110} label="Score" />
            <p className="text-sm text-slate-600">
              Save this reading and we'll build your dosing plan, shopping list, and weekly
              checklist from it.
            </p>
          </>
        ) : (
          <p className="py-2 text-sm text-slate-400">
            Fill in all fields to preview your Pool Health Score.
          </p>
        )}
      </section>

      <button className="btn-primary w-full py-3 text-base" disabled={!complete || saving} onClick={() => void save()}>
        {saving ? 'Saving…' : 'Save reading'}
      </button>
    </div>
  )
}
