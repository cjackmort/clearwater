import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { useAppStore } from '../store/useAppStore'
import { clearAllData, loadDemoData } from '../data/seed'
import { CameraIcon } from '../components/Icons'

export function SettingsPage() {
  const navigate = useNavigate()
  const pool = useActivePool()
  const pools = useLiveQuery(() => repos.pools.all(), [])
  const { activePoolId, setActivePool } = useAppStore()

  const [name, setName] = useState<string | null>(null)
  const [gallons, setGallons] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')

  if (!pool || pools === undefined) return null

  const editedName = name ?? pool.name
  const editedGallons = gallons ?? String(pool.gallons)
  const dirty = editedName !== pool.name || Number(editedGallons) !== pool.gallons

  async function savePool() {
    if (!pool || !dirty) return
    await repos.pools.update({
      ...pool,
      name: editedName.trim() || pool.name,
      gallons: Number(editedGallons) || pool.gallons,
    })
    setName(null)
    setGallons(null)
    setNotice('Pool updated.')
  }

  async function demo() {
    if (busy) return
    setBusy(true)
    const poolId = await loadDemoData()
    setActivePool(poolId)
    setBusy(false)
    setNotice('Demo data loaded — every screen is live now.')
  }

  async function reset() {
    if (busy) return
    setBusy(true)
    await clearAllData()
    setActivePool(null)
    setBusy(false)
    navigate('/onboarding', { replace: true })
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
          {notice}
        </div>
      )}

      <section className="card space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Pool profile</h2>
        <div>
          <label className="label-base" htmlFor="set-name">Name</label>
          <input
            id="set-name"
            className="input-base"
            value={editedName}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label-base" htmlFor="set-gallons">Gallons</label>
          <input
            id="set-gallons"
            className="input-base"
            type="number"
            inputMode="numeric"
            value={editedGallons}
            onChange={(e) => setGallons(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-400 capitalize">
          {pool.type} · {pool.surface}
        </p>
        {dirty && (
          <button className="btn-primary" onClick={() => void savePool()}>
            Save changes
          </button>
        )}
      </section>

      {pools.length > 1 && (
        <section className="card">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Switch pool</h2>
          <ul className="space-y-1.5">
            {pools.map((p) => (
              <li key={p.id}>
                <button
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    p.id === activePoolId
                      ? 'bg-cyan-50 font-semibold text-cyan-800 ring-1 ring-cyan-200'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => setActivePool(p.id)}
                >
                  {p.name} · {p.gallons.toLocaleString()} gal
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Demo & data</h2>
        <p className="text-sm text-slate-500">
          Load a 15,000-gallon demo pool with 8 weeks of readings (including an algae scare and
          recovery), a stocked inventory, and 6 purchases — every screen comes alive.
        </p>
        <button className="btn-primary w-full" disabled={busy} onClick={() => void demo()}>
          {busy ? 'Working…' : 'Load demo data'}
        </button>
        <p className="text-xs text-amber-600">
          Heads up: loading demo data replaces everything currently stored.
        </p>

        {confirmReset ? (
          <div className="rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
            <p className="mb-2 text-sm font-medium text-red-700">
              Delete all pools, readings, inventory, and purchases?
            </p>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                disabled={busy}
                onClick={() => void reset()}
              >
                Yes, erase it all
              </button>
            </div>
          </div>
        ) : (
          <button
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
            onClick={() => setConfirmReset(true)}
          >
            Erase all data
          </button>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <CameraIcon className="h-4 w-4 text-slate-400" /> Coming in Phase 2
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-500">
          <li>Snap a photo of your store test report — values auto-filled</li>
          <li>Receipt scanning straight into the ledger</li>
          <li>Cost prediction from your usage rate</li>
          <li>Cloud sync &amp; multi-device (Supabase)</li>
        </ul>
      </section>

      <p className="pb-2 text-center text-xs text-slate-300">
        ClearWater v0.1 · local-first, your data never leaves this device
      </p>
    </div>
  )
}
