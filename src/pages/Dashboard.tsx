import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { HealthRing } from '../components/HealthRing'
import { Sparkline } from '../components/Sparkline'
import { EmptyState } from '../components/EmptyState'
import { AlertIcon, DropletIcon, PlusIcon } from '../components/Icons'
import { computeBuyPlan, computeDosePlan } from '../domain/dosing'
import { ensureChecklistForReading, findSkipCallouts } from '../domain/checklist'
import { formatDateLong, formatMoney } from '../lib/format'

const SPARK_PARAMS = [
  { key: 'ph' as const, label: 'pH', color: '#8b5cf6', format: (v: number) => v.toFixed(1) },
  { key: 'fc' as const, label: 'FC ppm', color: '#0891b2', format: (v: number) => v.toFixed(1) },
  { key: 'ta' as const, label: 'TA ppm', color: '#10b981', format: (v: number) => v.toFixed(0) },
]

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
        message="Log your first water test and PoolLedger will score your water, build a dosing plan, and start your weekly checklist."
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

  return (
    <div className="space-y-4">
      {/* Health score */}
      <section className="card flex items-center gap-5">
        <HealthRing score={latest.health_score} />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">Last tested {formatDateLong(latest.date)}</p>
          <p className="mt-1 text-sm text-slate-600">
            {latest.health_score >= 85
              ? 'Your water is in great shape. Keep up the routine.'
              : latest.health_score >= 60
                ? 'A little off balance — this week’s checklist will bring it back.'
                : 'Your water needs attention. Work the checklist as soon as you can.'}
          </p>
          <Link to="/reading/new" className="btn-primary mt-3">
            <PlusIcon className="h-4 w-4" /> New reading
          </Link>
        </div>
      </section>

      {/* Skipped-treatment callouts */}
      {callouts?.map((c) => (
        <div
          key={c.param}
          className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200"
        >
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{c.label} still needs attention</span> — the matching
            treatment was skipped last week.
          </p>
        </div>
      ))}

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
            <div key={key} className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                {label}
              </p>
              <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                {format(latest[key])}
              </p>
              <Sparkline values={sparkValues.map((r) => r[key])} width={80} height={26} stroke={color} />
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
