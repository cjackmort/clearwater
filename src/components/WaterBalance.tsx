import { IDEAL } from '../domain/dosingConstants'
import type { Pool, Reading } from '../data/types'

type Status = 'low' | 'good' | 'high'

interface Param {
  key: keyof Reading
  short: string
  format: (v: number) => string
}

const PARAMS: Param[] = [
  { key: 'fc', short: 'FC', format: (v) => v.toFixed(1) },
  { key: 'ph', short: 'pH', format: (v) => v.toFixed(1) },
  { key: 'ta', short: 'TA', format: (v) => v.toFixed(0) },
  { key: 'ch', short: 'CH', format: (v) => v.toFixed(0) },
  { key: 'cya', short: 'CYA', format: (v) => v.toFixed(0) },
  { key: 'phosphates', short: 'PO₄', format: (v) => v.toFixed(0) },
]

const SALT_PARAM: Param = { key: 'salt', short: 'Salt', format: (v) => v.toFixed(0) }

function statusFor(key: string, value: number): Status {
  const range = IDEAL[key]
  if (!range) return 'good'
  if (value < range.min) return 'low'
  if (value > range.max) return 'high'
  return 'good'
}

const STYLES: Record<Status, { ring: string; text: string; badge: string; label: string }> = {
  good: {
    ring: 'ring-emerald-200 bg-emerald-50/60',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    label: 'Good',
  },
  low: {
    ring: 'ring-sky-200 bg-sky-50/60',
    text: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700',
    label: 'Low ↓',
  },
  high: {
    ring: 'ring-amber-200 bg-amber-50/60',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    label: 'High ↑',
  },
}

/** At-a-glance grid of each parameter's balance status vs. its ideal range. */
export function WaterBalance({ reading, pool }: { reading: Reading; pool: Pool }) {
  const params =
    pool.type === 'saltwater' && reading.salt !== undefined ? [...PARAMS, SALT_PARAM] : PARAMS
  const offCount = params.filter((p) => {
    const v = reading[p.key] as number | undefined
    return v !== undefined && statusFor(p.key as string, v) !== 'good'
  }).length

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Water balance</h2>
        <span
          className={`chip ${
            offCount === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {offCount === 0 ? 'All in range' : `${offCount} to adjust`}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {params.map((p) => {
          const value = reading[p.key] as number | undefined
          if (value === undefined) return null
          const status = statusFor(p.key as string, value)
          const s = STYLES[status]
          return (
            <div key={p.key as string} className={`rounded-xl p-2.5 ring-1 ${s.ring}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  {p.short}
                </span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${s.badge}`}>
                  {s.label}
                </span>
              </div>
              <p className={`mt-1 text-lg font-bold tabular-nums ${s.text}`}>{p.format(value)}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
