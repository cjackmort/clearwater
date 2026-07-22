import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { HealthRing } from '../components/HealthRing'
import { WaterBalance } from '../components/WaterBalance'
import { Sparkline } from '../components/Sparkline'
import { EmptyState } from '../components/EmptyState'
import { AlertIcon, DropletIcon, PlusIcon } from '../components/Icons'
import { computeBuyPlan, computeDosePlan } from '../domain/dosing'
import { scoreBand } from '../domain/healthScore'
import { ensureChecklistForReading, findSkipCallouts } from '../domain/checklist'
import { formatDateLong, formatMoney } from '../lib/format'

const SPARK_PARAMS = [
  { key: 'ph' as const, label: 'pH', color: '#8b5cf6', format: (v: number) => v.toFixed(1) },
  { key: 'fc' as const, label: 'FC ppm', color: '#0891b2', format: (v: number) => v.toFixed(1) },
  { key: 'ta' as const, label: 'TA ppm', color: '#10b981', format: (v: number) => v.toFixed(0) },
]

const HERO_GRADIENT: Record<string, string> = {
  green: 'from-emerald-400 via-teal-500 to-cyan-600',
  yellow: 'from-amber-400 via-orange-400 to-orange-500',
  red: 'from-rose-500 via-red-500 to-red-600',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const pool = useActivePool()
  const readings = useLiveQuery(
    () => (pool ? repos.readings.forPool(pool.id) : []),
    [pool?.id],
  )
  const inventory = useLiveQuery(
    () => (pool ? repos.inventory.forPool(pool.id) : []),
    [pool?.id],
  )
  const latest = readings?.[readings.length - 1]

  // Make sure this week's checklist exists so progress renders immediately.
  useEffect(() => {
    if (latest && pool && inventory) {
      void ensureChecklistForReading(latest, pool, inventory)
    }
  }, [latest?.id, pool?.id, inventory !== undefined])

  const checklist = useLiveQuery(
    () => (latest ? repos.checklist.forReading(latest.id) : []),
    [latest?.id],
  )
  const callouts = useLiveQuery(
    () => (pool && readings ? findSkipCallouts(readings, pool) : []),
    [pool?.id, readings?.length],
  )

  if (!pool || readings === undefined || inventory === undefined) return null

  if (!latest) {
    return (
      <EmptyState
        icon={<DropletIcon className="h-7 w-7" />}
        title="No readings yet"
        message="Log your first water test and ClearWater will score your water, build a dosing plan, and start your weekly checklist."
        action={
          <Link to="/reading/new" className="btn-primary">
            <PlusIcon className="h-4 w-4" /> Log first reading
          </Link>
        }
      />
    )
  }

  const buyPlan = computeBuyPlan(computeDosePlan(latest, pool), inventory)
  const lowStock = inventory.filter((i) => i.est_remaining_pct < 25)
  const done = checklist?.filter((c) => c.status !== 'pending').length ?? 0
  const total = checklist?.length ?? 0
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const sparkValues = readings.slice(-8)

  const band = scoreBand(latest.health_score)
  const statusMsg =
    latest.health_score >= 85
      ? 'Your water is in great shape. Keep up the routine.'
      : latest.health_score >= 60
        ? 'A little off balance — this week’s checklist will bring it back.'
        : 'Your water needs attention. Work the checklist as soon as you can.'

  return (
    <div className="space-y-4">
      {/* Health score hero */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${HERO_GRADIENT[band]} p-5 text-white shadow-lg shadow-cyan-900/20`}
      >
        {/* decorative bubbles */}
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-4">
          <HealthRing score={latest.health_score} onColor size={118} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/80">{greeting()}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/90">{statusMsg}</p>
            <p className="mt-1.5 text-[11px] text-white/70">
              Last tested {formatDateLong(latest.date)}
            </p>
            <Link
              to="/reading/new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/30 active:scale-[0.98]"
            >
              <PlusIcon className="h-4 w-4" /> New reading
            </Link>
          </div>
        </div>
      </section>

      {/* Water balance breakdown */}
      <WaterBalance reading={latest} pool={pool} />

      {/* Skipped-treatment callouts */}
      {callouts && callouts.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <div className="flex items-center gap-2">
            <AlertIcon className="h-4 w-4 shrink-0 text-amber-500" />
            <h2 className="text-sm font-semibold text-amber-900">Skipped last week</h2>
          </div>
          <ul className="mt-1.5 space-y-1 pl-6">
            {callouts.map((c) => (
              <li key={c.param} className="text-sm text-amber-800">
                {c.label} is still out of range — its treatment was skipped.
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Checklist progress */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">This week's checklist</h2>
          <Link to="/checklist" className="text-xs font-semibold text-cyan-700">
            View all →
          </Link>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-cyan-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700 tabular-nums">
            {done}/{total}
          </span>
        </div>
        {buyPlan.buy.length > 0 && (
          <p className="mt-3 rounded-xl bg-cyan-50 px-3 py-2 text-sm text-cyan-800">
            Buy list: {buyPlan.buy.length} item{buyPlan.buy.length > 1 ? 's' : ''} ·{' '}
            <span className="font-semibold">{formatMoney(buyPlan.estTotal)}</span> estimated
          </p>
        )}
      </section>

      {/* Trends sparklines */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Trends</h2>
          <Link to="/trends" className="text-xs font-semibold text-cyan-700">
            Full charts →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {SPARK_PARAMS.map(({ key, label, color, format }) => (
            <div
              key={key}
              className="rounded-xl bg-gradient-to-b from-slate-50 to-white p-3 ring-1 ring-slate-100"
            >
              <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </p>
              <p className="mt-0.5 mb-1.5 text-lg font-bold text-slate-900 tabular-nums">
                {format(latest[key])}
              </p>
              <Sparkline values={sparkValues.map((r) => r[key])} height={28} stroke={color} />
            </div>
          ))}
        </div>
      </section>

      {/* Low stock */}
      {lowStock.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Low stock</h2>
            <Link to="/inventory" className="text-xs font-semibold text-cyan-700">
              Inventory →
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {lowStock.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-slate-700">{item.product}</span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                  {item.est_remaining_pct}% left
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
