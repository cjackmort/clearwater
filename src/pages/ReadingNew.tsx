import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { HealthRing } from '../components/HealthRing'
import { CameraIcon } from '../components/Icons'
import { computeHealthScore } from '../domain/healthScore'
import { computeBuyPlan, computeDosePlan } from '../domain/dosing'
import { ensureChecklistForReading } from '../domain/checklist'
import { LOCAL_USER_ID, newId, type Reading } from '../data/types'

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

    // Store the computed buy list on the reading (mirrors what a scanned
    // store report will provide in Phase 2).
    const inventory = await repos.inventory.forPool(pool.id)
    const buyPlan = computeBuyPlan(computeDosePlan(reading, pool), inventory)
    reading.recommended_products = buyPlan.buy.map((b) => ({
      product: b.productName,
      quantity: b.packages,
      unit: b.packageUnit,
      reason: b.reason,
    }))

    await repos.readings.create(reading)
    await ensureChecklistForReading(reading, pool, inventory)
    navigate('/checklist')
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-400"
        title="Coming in Phase 2"
      >
        <CameraIcon className="h-5 w-5" />
        Scan a store test report — coming in Phase 2
      </button>

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
