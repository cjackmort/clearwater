import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { EmptyState } from '../components/EmptyState'
import { CheckIcon, ChecklistIcon, XIcon } from '../components/Icons'
import {
  completeChecklistItem,
  ensureChecklistForReading,
  skipChecklistItem,
} from '../domain/checklist'
import type { ChecklistItem } from '../data/types'
import { formatDateLong } from '../lib/format'

const SECTIONS: Array<{ type: ChecklistItem['action_type']; title: string; hint: string }> = [
  { type: 'add_chemical', title: 'Use what you have', hint: 'Doses covered by your inventory' },
  { type: 'buy', title: 'Buy list', hint: 'Pick these up before treating' },
  { type: 'task', title: 'Tasks', hint: 'Weekly upkeep' },
]

function ItemCard({ item, onDone, onSkip }: {
  item: ChecklistItem
  onDone: () => void
  onSkip: () => void
}) {
  const settled = item.status !== 'pending'
  return (
    <li
      className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-slate-900/5 transition ${
        settled ? 'opacity-60' : ''
      }`}
    >
      <p
        className={`min-w-0 flex-1 text-sm leading-snug ${
          item.status === 'done'
            ? 'text-slate-400 line-through'
            : item.status === 'skipped'
              ? 'text-slate-400'
              : 'text-slate-700'
        }`}
      >
        {item.label}
        {item.status === 'skipped' && (
          <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 uppercase">
            skipped
          </span>
        )}
      </p>
      {!settled && (
        <div className="flex shrink-0 gap-2">
          <button
            aria-label="Mark done"
            onClick={onDone}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 active:scale-95"
          >
            <CheckIcon className="h-5 w-5" />
          </button>
          <button
            aria-label="Skip"
            onClick={onSkip}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-slate-200 active:scale-95"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      {item.status === 'done' && <CheckIcon className="h-5 w-5 shrink-0 text-emerald-500" />}
    </li>
  )
}

export function ChecklistPage() {
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

  useEffect(() => {
    if (latest && pool && inventory) {
      void ensureChecklistForReading(latest, pool, inventory)
    }
  }, [latest?.id, pool?.id, inventory !== undefined])

  const items = useLiveQuery(
    () => (latest ? repos.checklist.forReading(latest.id) : []),
    [latest?.id],
  )

  if (!pool || readings === undefined || items === undefined) return null

  if (!latest) {
    return (
      <EmptyState
        icon={<ChecklistIcon className="h-7 w-7" />}
        title="No checklist yet"
        message="Your weekly checklist is generated from your latest water test. Log a reading to get your action plan."
        action={
          <Link to="/reading/new" className="btn-primary">
            Log a reading
          </Link>
        }
      />
    )
  }

  const done = items.filter((i) => i.status !== 'pending').length
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Week of {formatDateLong(latest.date)}
            </h2>
            <p className="text-xs text-slate-400">
              Generated from your latest reading · score {latest.health_score}
            </p>
          </div>
          <span className="text-2xl font-bold text-cyan-700 tabular-nums">{pct}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-cyan-600 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {items.length === 0 && (
        <EmptyState
          icon={<CheckIcon className="h-7 w-7" />}
          title="Nothing to do"
          message="Your water is balanced and your inventory is stocked. Enjoy the pool!"
        />
      )}

      {SECTIONS.map(({ type, title, hint }) => {
        const group = items.filter((i) => i.action_type === type)
        if (group.length === 0) return null
        return (
          <section key={type}>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <span className="text-xs text-slate-400">{hint}</span>
            </div>
            <ul className="space-y-2">
              {group.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onDone={() => void completeChecklistItem(item, pool)}
                  onSkip={() => void skipChecklistItem(item)}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
