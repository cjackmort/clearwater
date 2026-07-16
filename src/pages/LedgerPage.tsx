import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { EmptyState } from '../components/EmptyState'
import { CameraIcon, LedgerIcon, PlusIcon, TrashIcon, XIcon } from '../components/Icons'
import { categoryForProduct } from '../domain/catalog'
import { formatDateLong, formatMoney, monthKey, monthLabel } from '../lib/format'
import {
  LOCAL_USER_ID,
  newId,
  type Transaction,
  type TransactionItem,
} from '../data/types'

interface TxWithItems extends Transaction {
  items: TransactionItem[]
}

interface LineDraft {
  product: string
  qty: string
  unit_price: string
}

const BLANK_LINE: LineDraft = { product: '', qty: '1', unit_price: '' }

export function LedgerPage() {
  const pool = useActivePool()
  const txs = useLiveQuery(async (): Promise<TxWithItems[] | undefined> => {
    if (!pool) return []
    const list = await repos.transactions.forPool(pool.id)
    return Promise.all(
      list.map(async (tx) => ({ ...tx, items: await repos.transactions.itemsFor(tx.id) })),
    )
  }, [pool?.id])

  const [adding, setAdding] = useState(false)
  const [store, setStore] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<LineDraft[]>([{ ...BLANK_LINE }])
  const [expanded, setExpanded] = useState<string | null>(null)

  if (!pool || txs === undefined) return null

  const draftTotal = lines.reduce(
    (sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_price) || 0),
    0,
  )
  const draftValid =
    store.trim().length > 0 &&
    lines.some((l) => l.product.trim() && Number(l.qty) > 0 && Number(l.unit_price) > 0)

  async function saveTransaction() {
    if (!pool || !draftValid) return
    const txId = newId()
    const items: TransactionItem[] = lines
      .filter((l) => l.product.trim() && Number(l.qty) > 0 && Number(l.unit_price) > 0)
      .map((l) => ({
        id: newId(),
        user_id: LOCAL_USER_ID,
        transaction_id: txId,
        product: l.product.trim(),
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
      }))
    await repos.transactions.create(
      {
        id: txId,
        user_id: LOCAL_USER_ID,
        pool_id: pool.id,
        store: store.trim(),
        date: new Date(`${date}T12:00:00`).toISOString(),
        total: Math.round(items.reduce((s, i) => s + i.qty * i.unit_price, 0) * 100) / 100,
      },
      items,
    )
    setAdding(false)
    setStore('')
    setLines([{ ...BLANK_LINE }])
  }

  // Monthly totals for the last 6 months (including empty months).
  const months: { key: string; label: string; total: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d.toISOString())
    months.push({ key, label: monthLabel(key), total: 0 })
  }
  for (const tx of txs) {
    const bucket = months.find((m) => m.key === monthKey(tx.date))
    if (bucket) bucket.total = Math.round((bucket.total + tx.total) * 100) / 100
  }

  // Category breakdown across all line items.
  const byCategory = new Map<string, number>()
  for (const tx of txs) {
    for (const item of tx.items) {
      const cat = categoryForProduct(item.product)
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + item.qty * item.unit_price)
    }
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  const categoryMax = categories[0]?.[1] ?? 1
  const allTimeTotal = txs.reduce((s, t) => s + t.total, 0)
  const thisMonth = months[months.length - 1].total

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            This month
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(thisMonth)}
          </p>
        </div>
        <div className="card">
          <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
            All time
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {formatMoney(allTimeTotal)}
          </p>
        </div>
      </div>

      {txs.length > 0 && (
        <>
          <section className="card">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Monthly spend</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={months} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={52}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                  formatter={(value) => [formatMoney(Number(value)), 'Spend']}
                />
                <Bar dataKey="total" fill="#0891b2" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">By category</h2>
            <ul className="space-y-2.5">
              {categories.map(([cat, total]) => (
                <li key={cat}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-600">{cat}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {formatMoney(total)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-cyan-600/80"
                      style={{ width: `${Math.max(4, (total / categoryMax) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <div className="flex gap-3">
        <button className="btn-primary flex-1" onClick={() => setAdding(true)}>
          <PlusIcon className="h-4 w-4" /> Add purchase
        </button>
        <button
          className="btn-secondary flex-1 text-slate-400"
          disabled
          title="Coming in Phase 2"
        >
          <CameraIcon className="h-4 w-4" /> Scan receipt · Phase 2
        </button>
      </div>

      {txs.length === 0 ? (
        <EmptyState
          icon={<LedgerIcon className="h-7 w-7" />}
          title="No purchases logged"
          message="Track what you spend at the pool store and PoolLedger will show you exactly where the money goes."
        />
      ) : (
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-slate-900">Purchases</h2>
          <ul className="space-y-2">
            {txs.map((tx) => (
              <li key={tx.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-900/5">
                <button
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{tx.store}</p>
                    <p className="text-xs text-slate-400">
                      {formatDateLong(tx.date)} · {tx.items.length} item
                      {tx.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-bold text-slate-900 tabular-nums">
                    {formatMoney(tx.total)}
                  </span>
                </button>
                {expanded === tx.id && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <ul className="space-y-1.5">
                      {tx.items.map((item) => (
                        <li key={item.id} className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            {item.qty} × {item.product}
                          </span>
                          <span className="text-slate-500 tabular-nums">
                            {formatMoney(item.qty * item.unit_price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-500"
                      onClick={() => void repos.transactions.remove(tx.id)}
                    >
                      <TrashIcon className="h-3.5 w-3.5" /> Delete purchase
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Add purchase sheet */}
      {adding && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/40 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Add purchase</h2>
              <button
                aria-label="Close"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setAdding(false)}
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base" htmlFor="tx-store">Store</label>
                  <input
                    id="tx-store"
                    className="input-base"
                    placeholder="Leslie's, Home Depot…"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label-base" htmlFor="tx-date">Date</label>
                  <input
                    id="tx-date"
                    className="input-base"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <span className="label-base">Items</span>
                <div className="space-y-2">
                  {lines.map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="input-base flex-1"
                        placeholder="Product"
                        value={line.product}
                        onChange={(e) =>
                          setLines(lines.map((l, j) => (j === i ? { ...l, product: e.target.value } : l)))
                        }
                      />
                      <input
                        className="input-base w-14 text-center"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        aria-label="Quantity"
                        value={line.qty}
                        onChange={(e) =>
                          setLines(lines.map((l, j) => (j === i ? { ...l, qty: e.target.value } : l)))
                        }
                      />
                      <input
                        className="input-base w-20"
                        type="number"
                        inputMode="decimal"
                        placeholder="$"
                        aria-label="Unit price"
                        value={line.unit_price}
                        onChange={(e) =>
                          setLines(
                            lines.map((l, j) => (j === i ? { ...l, unit_price: e.target.value } : l)),
                          )
                        }
                      />
                      {lines.length > 1 && (
                        <button
                          aria-label="Remove line"
                          className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:text-red-500"
                          onClick={() => setLines(lines.filter((_, j) => j !== i))}
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-cyan-700"
                  onClick={() => setLines([...lines, { ...BLANK_LINE }])}
                >
                  <PlusIcon className="h-3.5 w-3.5" /> Add line
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-500">Total</span>
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {formatMoney(draftTotal)}
                </span>
              </div>

              <button
                className="btn-primary w-full py-3"
                disabled={!draftValid}
                onClick={() => void saveTransaction()}
              >
                Save purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
