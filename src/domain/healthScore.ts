import { IDEAL, type Range } from './dosingConstants'
import type { PoolType, Reading } from '../data/types'

/**
 * Composite Pool Health Score (0–100).
 *
 * Each parameter earns a 0–100 subscore: 100 inside its ideal range, decaying
 * linearly with distance outside it (normalized by a per-parameter tolerance —
 * the distance at which the subscore hits 0). Subscores are combined with
 * weights reflecting how much each parameter matters to swimmer safety and
 * water quality.
 */

interface ParamSpec {
  key: string
  weight: number
  /** Distance beyond the ideal range at which the subscore reaches 0 */
  tolerance: number
}

const PARAMS: ParamSpec[] = [
  { key: 'fc', weight: 25, tolerance: 3 },
  { key: 'cc', weight: 15, tolerance: 1 },
  { key: 'ph', weight: 20, tolerance: 0.6 },
  { key: 'ta', weight: 10, tolerance: 60 },
  { key: 'ch', weight: 10, tolerance: 200 },
  { key: 'cya', weight: 10, tolerance: 50 },
  { key: 'phosphates', weight: 10, tolerance: 900 },
]

const SALT_PARAM: ParamSpec = { key: 'salt', weight: 10, tolerance: 800 }

export function subscore(value: number, range: Range, tolerance: number): number {
  const distance = value < range.min ? range.min - value : value > range.max ? value - range.max : 0
  return Math.max(0, 100 * (1 - distance / tolerance))
}

export interface ReadingValues {
  fc: number
  tc: number
  ph: number
  ta: number
  ch: number
  cya: number
  phosphates: number
  salt?: number
}

export function computeHealthScore(values: ReadingValues, poolType: PoolType): number {
  const cc = Math.max(0, values.tc - values.fc)
  const lookup: Record<string, number | undefined> = { ...values, cc }
  const params =
    poolType === 'saltwater' && values.salt !== undefined ? [...PARAMS, SALT_PARAM] : PARAMS

  let weighted = 0
  let totalWeight = 0
  for (const p of params) {
    const value = lookup[p.key]
    if (value === undefined || Number.isNaN(value)) continue
    weighted += subscore(value, IDEAL[p.key], p.tolerance) * p.weight
    totalWeight += p.weight
  }
  if (totalWeight === 0) return 0
  return Math.round(weighted / totalWeight)
}

export type ScoreBand = 'red' | 'yellow' | 'green'

export function scoreBand(score: number): ScoreBand {
  if (score < 60) return 'red'
  if (score < 85) return 'yellow'
  return 'green'
}

export const SCORE_COLORS: Record<ScoreBand, string> = {
  red: '#ef4444',
  yellow: '#f59e0b',
  green: '#10b981',
}

/** Which parameters of a reading are outside their ideal range. */
export function outOfRangeParams(reading: Reading, poolType: PoolType): string[] {
  const cc = Math.max(0, reading.tc - reading.fc)
  const checks: [string, number | undefined][] = [
    ['fc', reading.fc],
    ['cc', cc],
    ['ph', reading.ph],
    ['ta', reading.ta],
    ['ch', reading.ch],
    ['cya', reading.cya],
    ['phosphates', reading.phosphates],
  ]
  if (poolType === 'saltwater' && reading.salt !== undefined) checks.push(['salt', reading.salt])
  return checks
    .filter(([key, value]) => {
      if (value === undefined) return false
      const range = IDEAL[key]
      return value < range.min || value > range.max
    })
    .map(([key]) => key)
}
