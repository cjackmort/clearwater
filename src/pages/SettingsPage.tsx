import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { useAppStore } from '../store/useAppStore'
import { clearAllData, loadDemoData } from '../data/seed'
import { getScanConfig, setScanConfig, type ScanProvider } from '../lib/scanConfig'
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
  const [scan, setScan] = useState(() => getScanConfig())

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

  function updateScan(patch: Partial<typeof scan>): void {
    setScan(setScanConfig(patch))
  }

  const providerKey = scan.provider === 'anthropic' ? scan.anthropicKey : scan.geminiKey
  const providerMeta: Record<ScanProvider, { label: string; placeholder: string; help: string; url: string }> = {
    gemini: {
      label: 'Google Gemini',
      placeholder: 'AIza…',
      help: 'Free for personal use. Create a key at aistudio.google.com/apikey',
      url: 'https://aistudio.google.com/apikey',
    },
    anthropic: {
      label: 'Anthropic Claude',
      placeholder: 'sk-ant-…',
      help: 'Pay-per-scan. Create a key at console.anthropic.com',
      url: 'https://console.anthropic.com',
    },
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
          {pool.vessel === 'hot_tub' ? 'hot tub' : 'pool'} · {pool.type} · {pool.surface}
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
                  {p.vessel === 'hot_tub' ? ' · Hot tub' : ''}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <button className="btn-secondary w-full" onClick={() => navigate('/onboarding')}>
          Add a pool or hot tub
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Scanning</h2>
        <p className="text-sm text-slate-500">
          Scanning test reports and receipts runs <span className="font-medium text-slate-600">free
          on this device</span> — no key, no account, and your photos never leave it.
        </p>

        <label className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <span className="text-sm">
            <span className="font-medium text-slate-800">Double-check scans with AI</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Optional second pass that fills gaps and fixes misread values. Uses your own key.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
            checked={scan.aiEnabled}
            onChange={(e) => updateScan({ aiEnabled: e.target.checked })}
          />
        </label>

        {scan.aiEnabled && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(['gemini', 'anthropic'] as ScanProvider[]).map((p) => (
                <button
                  key={p}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    scan.provider === p
                      ? 'bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200'
                      : 'text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                  onClick={() => updateScan({ provider: p })}
                >
                  {providerMeta[p].label}
                  <span className="block text-[11px] font-normal text-slate-400">
                    {p === 'gemini' ? 'Free tier' : 'Pay-per-scan'}
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="label-base" htmlFor="set-api-key">
                {providerMeta[scan.provider].label} API key
              </label>
              <input
                id="set-api-key"
                className="input-base"
                type="password"
                placeholder={providerMeta[scan.provider].placeholder}
                value={providerKey}
                onChange={(e) =>
                  setScan((s) => ({
                    ...s,
                    ...(s.provider === 'anthropic'
                      ? { anthropicKey: e.target.value }
                      : { geminiKey: e.target.value }),
                  }))
                }
              />
              <p className="mt-1 text-xs text-slate-400">{providerMeta[scan.provider].help}</p>
            </div>

            <button
              className="btn-primary"
              onClick={() => {
                const saved = setScanConfig({
                  geminiKey: scan.geminiKey,
                  anthropicKey: scan.anthropicKey,
                })
                setScan(saved)
                const key = saved.provider === 'anthropic' ? saved.anthropicKey : saved.geminiKey
                setNotice(key ? 'API key saved.' : 'API key cleared.')
              }}
            >
              Save key
            </button>
          </div>
        )}
      </section>

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
          <CameraIcon className="h-4 w-4 text-slate-400" /> Coming next
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate-500">
          <li>Cloud sync &amp; multi-device (Supabase)</li>
        </ul>
      </section>

      <p className="pb-2 text-center text-xs text-slate-300">
        ClearWater v0.1 · local-first, your data never leaves this device
      </p>
    </div>
  )
}
