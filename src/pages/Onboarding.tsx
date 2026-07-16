import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { repos } from '../data/repositories'
import { LOCAL_USER_ID, newId, type PoolSurface, type PoolType, type VesselKind } from '../data/types'
import { useAppStore } from '../store/useAppStore'
import { DropletIcon } from '../components/Icons'
import { loadDemoData } from '../data/seed'

type Shape = 'rectangle' | 'round' | 'oval'

/**
 * Gallons formulas:
 *   rectangle: L × W × avg depth × 7.5
 *   round:     diameter² × avg depth × 5.9
 *   oval:      L × W × avg depth × 5.9
 */
function calcGallons(shape: Shape, length: number, width: number, diameter: number, depth: number): number {
  if (!depth) return 0
  if (shape === 'rectangle') return Math.round(length * width * depth * 7.5)
  if (shape === 'round') return Math.round(diameter * diameter * depth * 5.9)
  return Math.round(length * width * depth * 5.9)
}

const SEGMENT =
  'flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition'
const SEGMENT_ON = 'bg-white text-cyan-700 shadow-sm'
const SEGMENT_OFF = 'text-slate-500 hover:text-slate-700'

const VESSELS: Array<{ value: VesselKind; label: string }> = [
  { value: 'pool', label: 'Pool' },
  { value: 'hot_tub', label: 'Hot tub' },
]

export function Onboarding() {
  const navigate = useNavigate()
  const setActivePool = useAppStore((s) => s.setActivePool)
  const existingPools = useLiveQuery(() => repos.pools.all(), [])
  const hasPools = (existingPools?.length ?? 0) > 0

  const [name, setName] = useState('')
  const [vessel, setVessel] = useState<VesselKind>('pool')
  const [type, setType] = useState<PoolType>('chlorine')
  const [surface, setSurface] = useState<PoolSurface>('plaster')
  const [mode, setMode] = useState<'direct' | 'calculator'>('direct')
  const [gallonsDirect, setGallonsDirect] = useState('')
  const [shape, setShape] = useState<Shape>('rectangle')
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [diameter, setDiameter] = useState('')
  const [depth, setDepth] = useState('')
  const [saving, setSaving] = useState(false)

  const calculated = useMemo(
    () => calcGallons(shape, Number(length) || 0, Number(width) || 0, Number(diameter) || 0, Number(depth) || 0),
    [shape, length, width, diameter, depth],
  )
  const gallons = mode === 'direct' ? Number(gallonsDirect) || 0 : calculated
  const valid = name.trim().length > 0 && gallons > 0

  async function createPool() {
    if (!valid || saving) return
    setSaving(true)
    const id = newId()
    await repos.pools.create({
      id,
      user_id: LOCAL_USER_ID,
      name: name.trim(),
      gallons,
      type,
      surface,
      vessel,
      created_at: new Date().toISOString(),
    })
    setActivePool(id)
    navigate('/', { replace: true })
  }

  async function demoInstead() {
    if (saving) return
    setSaving(true)
    const poolId = await loadDemoData()
    setActivePool(poolId)
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-slate-50 px-4 py-8 sm:border-x sm:border-slate-200/80 sm:shadow-xl sm:shadow-slate-300/40">
      {hasPools && (
        <Link
          to="/settings"
          className="mb-4 self-start text-sm font-medium text-cyan-700 underline-offset-4 hover:underline"
        >
          &larr; Back
        </Link>
      )}
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-600 text-white shadow-lg shadow-cyan-600/25">
          <DropletIcon className="h-8 w-8" />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to ClearWater</h1>
        <p className="mt-1 max-w-xs text-sm text-slate-500">
          {vessel === 'hot_tub'
            ? "Set up your pool or hot tub and we'll turn every water test into a plan."
            : "Set up your pool profile and we'll turn every water test into a plan."}
        </p>
      </div>

      <div className="card space-y-5">
        <div>
          <label className="label-base" htmlFor="pool-name">Pool name</label>
          <input
            id="pool-name"
            className="input-base"
            placeholder="e.g. Backyard Pool"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <span className="label-base">Vessel</span>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {VESSELS.map((v) => (
              <button key={v.value} type="button" onClick={() => setVessel(v.value)}
                className={`${SEGMENT} ${vessel === v.value ? SEGMENT_ON : SEGMENT_OFF}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label-base">Type</span>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(['chlorine', 'saltwater'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`${SEGMENT} ${type === t ? SEGMENT_ON : SEGMENT_OFF}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label-base">Surface</span>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {(['plaster', 'vinyl', 'fiberglass'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSurface(s)}
                className={`${SEGMENT} ${surface === s ? SEGMENT_ON : SEGMENT_OFF}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label-base">Volume</span>
          <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setMode('direct')}
              className={`${SEGMENT} ${mode === 'direct' ? SEGMENT_ON : SEGMENT_OFF}`}>
              I know my gallons
            </button>
            <button type="button" onClick={() => setMode('calculator')}
              className={`${SEGMENT} ${mode === 'calculator' ? SEGMENT_ON : SEGMENT_OFF}`}>
              Calculate it
            </button>
          </div>

          {mode === 'direct' ? (
            <input
              className="input-base"
              type="number"
              inputMode="numeric"
              placeholder={vessel === 'hot_tub' ? 'e.g. 400' : 'e.g. 15000'}
              value={gallonsDirect}
              onChange={(e) => setGallonsDirect(e.target.value)}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                {(['rectangle', 'round', 'oval'] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setShape(s)}
                    className={`${SEGMENT} ${shape === s ? SEGMENT_ON : SEGMENT_OFF}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {shape === 'round' ? (
                  <div>
                    <label className="label-base" htmlFor="diameter">Diameter (ft)</label>
                    <input id="diameter" className="input-base" type="number" inputMode="decimal"
                      value={diameter} onChange={(e) => setDiameter(e.target.value)} />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="label-base" htmlFor="length">Length (ft)</label>
                      <input id="length" className="input-base" type="number" inputMode="decimal"
                        value={length} onChange={(e) => setLength(e.target.value)} />
                    </div>
                    <div>
                      <label className="label-base" htmlFor="width">Width (ft)</label>
                      <input id="width" className="input-base" type="number" inputMode="decimal"
                        value={width} onChange={(e) => setWidth(e.target.value)} />
                    </div>
                  </>
                )}
                <div>
                  <label className="label-base" htmlFor="depth">Avg depth (ft)</label>
                  <input id="depth" className="input-base" type="number" inputMode="decimal"
                    value={depth} onChange={(e) => setDepth(e.target.value)} />
                </div>
              </div>
              <div className="rounded-xl bg-cyan-50 px-4 py-3 text-center">
                <span className="text-2xl font-bold text-cyan-700 tabular-nums">
                  {calculated.toLocaleString()}
                </span>
                <span className="ml-1.5 text-sm font-medium text-cyan-600">gallons</span>
              </div>
            </div>
          )}
        </div>

        <button className="btn-primary w-full py-3 text-base" disabled={!valid || saving} onClick={createPool}>
          Create my pool
        </button>
      </div>

      <button
        className="mt-4 text-sm font-medium text-cyan-700 underline-offset-4 hover:underline disabled:opacity-40"
        disabled={saving}
        onClick={demoInstead}
      >
        Just exploring? Load the demo pool instead
      </button>
    </div>
  )
}
