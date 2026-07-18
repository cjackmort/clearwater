import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { hasApiKey } from '../lib/apiKey'
import { prepareImage } from '../lib/image'
import { reportScanner, ScanError } from '../services/scanner'
import { HealthRing } from '../components/HealthRing'
import { CameraIcon } from '../components/Icons'
import { computeHealthScore } from '../domain/healthScore'
import { computeBuyPlan, computeDosePlan } from '../domain/dosing'
import { ensureChecklistForReading } from '../domain/checklist'
import { LOCAL_USER_ID, newId, type Reading, type RecommendedProduct } from '../data/types'

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
  const [needsKey, setNeedsKey] = useState(false)
  const [scanDone, setScanDone] = useState(false)
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
    if (!hasApiKey()) {
      setNeedsKey(true)
      return
    }
    setNeedsKey(false)
    fileInputRef.current?.click()
  }

  async function scanFile(file: File) {
    setScanning(true)
    setScanError('')
    setScanDone(false)
    try {
      const img = await prepareImage(file)
      const scan = await reportScanner.scanReport(img.base64, img.mediaType)
      const filled: Record<string, string> = {}
      for (const key of ['fc', 'tc', 'ph', 'ta', 'ch', 'cya', 'phosphates', 'salt'] as const) {
        const value = scan[key]
        if (value !== undefined) filled[key] = String(value)
      }
      setValues((v) => ({ ...v, ...filled }))
      setScannedPhotoUrl(img.dataUrl)
      setScannedProducts(scan.recommended_products)
      setScannedGallons(scan.gallons ?? null)
      setScanDone(true)
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
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cyan-300 bg-white px-4 py-3.5 text-sm font-medium text-cyan-700 transition hover:bg-cyan-50 disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
        onClick={startScan}
      >
        <CameraIcon className="h-5 w-5" />
        {scanning ? 'Reading your report…' : 'Scan a store test report'}
      </button>

      {needsKey && (
        <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          Add your Anthropic API key in Settings to enable scanning.{' '}
          <Link to="/settings" className="font-semibold underline">
            Open Settings →
          </Link>
        </div>
      )}

      {scanError && (
        <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
          {scanError}
        </div>
      )}

      {scanDone && (
        <p className="text-sm text-emerald-700">
          Report scanned — review the values below, then save.
        </p>
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
          {fields.map((f) => (
            <div key={f.key}>
              <label className="label-base" htmlFor={`reading-${f.key}`}>
                {f.label} {f.unit && <span className="text-slate-300">({f.unit})</span>}
              </label>
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
          ))}
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
