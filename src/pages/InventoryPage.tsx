import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { EmptyState } from '../components/EmptyState'
import { InventoryIcon, PlusIcon, TrashIcon, XIcon } from '../components/Icons'
import { CATALOG, catalogById } from '../domain/catalog'
import { LOCAL_USER_ID, newId, type InventoryItem } from '../data/types'

const LOW_STOCK_PCT = 25

function RemainingBar({ pct }: { pct: number }) {
  const color = pct < LOW_STOCK_PCT ? 'bg-red-500' : pct < 50 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

interface FormState {
  id?: string
  catalogId: string
  product: string
  category: string
  quantity: string
  unit: string
  pct: number
}

const BLANK: FormState = {
  catalogId: CATALOG[0].id,
  product: CATALOG[0].name,
  category: CATALOG[0].category,
  quantity: '',
  unit: CATALOG[0].unit,
  pct: 100,
}

export function InventoryPage() {
  const pool = useActivePool()
  const items = useLiveQuery(
    () => (pool ? repos.inventory.forPool(pool.id) : []),
    [pool?.id],
  )
  const [form, setForm] = useState<FormState | null>(null)

  if (!pool || items === undefined) return null

  function openAdd() {
    setForm({ ...BLANK })
  }

  function openEdit(item: InventoryItem) {
    setForm({
      id: item.id,
      catalogId: 'custom',
      product: item.product,
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit,
      pct: item.est_remaining_pct,
    })
  }

  function pickCatalog(catalogId: string) {
    if (!form) return
    if (catalogId === 'custom') {
      setForm({ ...form, catalogId })
      return
    }
    const product = catalogById(catalogId)!
    setForm({
      ...form,
      catalogId,
      product: product.name,
      category: product.category,
      unit: product.unit,
      quantity: form.quantity || String(product.packageSize),
    })
  }

  async function save() {
    if (!form || !pool) return
    const quantity = Number(form.quantity)
    if (!form.product.trim() || !quantity || quantity <= 0) return
    const record: InventoryItem = {
      id: form.id ?? newId(),
      user_id: LOCAL_USER_ID,
      pool_id: pool.id,
      product: form.product.trim(),
      category: form.category,
      quantity,
      unit: form.unit,
      est_remaining_pct: form.pct,
    }
    if (form.id) {
      await repos.inventory.update(record)
    } else {
      await repos.inventory.create(record)
    }
    setForm(null)
  }

  async function remove() {
    if (form?.id) await repos.inventory.remove(form.id)
    setForm(null)
  }

  const lowCount = items.filter((i) => i.est_remaining_pct < LOW_STOCK_PCT).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {items.length} item{items.length === 1 ? '' : 's'}
          {lowCount > 0 && (
            <span className="ml-2 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
              {lowCount} low
            </span>
          )}
        </p>
        <button className="btn-primary" onClick={openAdd}>
          <PlusIcon className="h-4 w-4" /> Add item
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<InventoryIcon className="h-7 w-7" />}
          title="Nothing on the shelf"
          message="Track the chemicals you have on hand and the buy list will only tell you to shop when you actually need to."
          action={
            <button className="btn-primary" onClick={openAdd}>
              <PlusIcon className="h-4 w-4" /> Add your first item
            </button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-900/5 transition hover:ring-cyan-500/40"
                onClick={() => openEdit(item)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.product}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {item.category} · {item.quantity} {item.unit}
                    </p>
                  </div>
                  {item.est_remaining_pct < LOW_STOCK_PCT && (
                    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                      Low stock
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <RemainingBar pct={item.est_remaining_pct} />
                  <span className="shrink-0 text-xs font-semibold text-slate-500 tabular-nums">
                    {item.est_remaining_pct}%
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit sheet */}
      {form && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-slate-900/40 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-xl sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {form.id ? 'Edit item' : 'Add to inventory'}
              </h2>
              <button
                aria-label="Close"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                onClick={() => setForm(null)}
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {!form.id && (
                <div>
                  <label className="label-base" htmlFor="inv-catalog">Product</label>
                  <select
                    id="inv-catalog"
                    className="input-base"
                    value={form.catalogId}
                    onChange={(e) => pickCatalog(e.target.value)}
                  >
                    {CATALOG.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                    <option value="custom">Custom product…</option>
                  </select>
                </div>
              )}

              {(form.catalogId === 'custom' || form.id) && (
                <div>
                  <label className="label-base" htmlFor="inv-name">Name</label>
                  <input
                    id="inv-name"
                    className="input-base"
                    value={form.product}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base" htmlFor="inv-qty">Quantity</label>
                  <input
                    id="inv-qty"
                    className="input-base"
                    type="number"
                    inputMode="decimal"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-base" htmlFor="inv-unit">Unit</label>
                  <input
                    id="inv-unit"
                    className="input-base"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label-base" htmlFor="inv-pct">
                  Estimated remaining: <span className="text-cyan-700">{form.pct}%</span>
                </label>
                <input
                  id="inv-pct"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.pct}
                  onChange={(e) => setForm({ ...form, pct: Number(e.target.value) })}
                  className="w-full accent-cyan-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                {form.id && (
                  <button
                    className="btn-secondary text-red-600 ring-red-200"
                    onClick={() => void remove()}
                  >
                    <TrashIcon className="h-4 w-4" /> Delete
                  </button>
                )}
                <button className="btn-primary flex-1" onClick={() => void save()}>
                  {form.id ? 'Save changes' : 'Add item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
