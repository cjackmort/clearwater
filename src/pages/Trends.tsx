import { useLiveQuery } from 'dexie-react-hooks'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { repos } from '../data/repositories'
import { useActivePool } from '../lib/hooks'
import { EmptyState } from '../components/EmptyState'
import { TrendsIcon } from '../components/Icons'
import { Link } from 'react-router-dom'
import { IDEAL, PARAM_UNITS } from '../domain/dosingConstants'
import { formatDate } from '../lib/format'

interface ChartSpec {
  key: string
  label: string
  color: string
  /** ideal band lookup key in IDEAL (omit for health score) */
  ideal?: string
}

const CHARTS: ChartSpec[] = [
  { key: 'health_score', label: 'Health Score', color: '#0891b2' },
  { key: 'fc', label: 'Free Chlorine', color: '#0891b2', ideal: 'fc' },
  { key: 'ph', label: 'pH', color: '#8b5cf6', ideal: 'ph' },
  { key: 'ta', label: 'Total Alkalinity', color: '#10b981', ideal: 'ta' },
  { key: 'ch', label: 'Calcium Hardness', color: '#f59e0b', ideal: 'ch' },
  { key: 'cya', label: 'CYA (Stabilizer)', color: '#ec4899', ideal: 'cya' },
  { key: 'phosphates', label: 'Phosphates', color: '#64748b', ideal: 'phosphates' },
]

const SALT_CHART: ChartSpec = { key: 'salt', label: 'Salt', color: '#06b6d4', ideal: 'salt' }

export function Trends() {
  const pool = useActivePool()
  const readings = useLiveQuery(
    () => (pool ? repos.readings.forPool(pool.id) : []),
    [pool?.id],
  )

  if (!pool || readings === undefined) return null

  if (readings.length < 2) {
    return (
      <EmptyState
        icon={<TrendsIcon className="h-7 w-7" />}
        title="Not enough data yet"
        message="Log at least two readings and your parameter trends will chart here, with ideal ranges shaded in."
        action={
          <Link to="/reading/new" className="btn-primary">
            Log a reading
          </Link>
        }
      />
    )
  }

  const data = readings.map((r) => ({ ...r, dateLabel: formatDate(r.date) }))
  const charts = pool.type === 'saltwater' ? [...CHARTS, SALT_CHART] : CHARTS

  return (
    <div className="space-y-4">
      {charts.map(({ key, label, color, ideal }) => {
        const range = ideal ? IDEAL[ideal] : undefined
        const values = data
          .map((d) => d[key as keyof typeof d] as number | undefined)
          .filter((v): v is number => typeof v === 'number')
        if (values.length < 2) return null
        const unit = PARAM_UNITS[key] ?? (key === 'health_score' ? '' : '')
        const dataMin = Math.min(...values, range?.min ?? Infinity)
        const dataMax = Math.max(...values, range ? Math.min(range.max, 1e6) : -Infinity)
        const pad = (dataMax - dataMin) * 0.15 || 1

        const gradId = `area-${key}`
        return (
          <section key={key} className="card">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </h2>
              <span className="text-xs text-slate-400">
                {range
                  ? range.min === 0
                    ? `ideal < ${range.max} ${unit}`
                    : `ideal ${range.min}–${range.max} ${unit}`
                  : '0–100'}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  domain={
                    key === 'health_score'
                      ? [0, 100]
                      : [Math.max(0, Math.floor(dataMin - pad)), Math.ceil(dataMax + pad)]
                  }
                  width={46}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                  }}
                  formatter={(value) => [`${value} ${unit}`.trim(), label]}
                />
                {range && (
                  <ReferenceArea
                    y1={range.min}
                    y2={range.max}
                    fill={color}
                    fillOpacity={0.09}
                    stroke={color}
                    strokeOpacity={0.25}
                    strokeDasharray="4 4"
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2.5}
                  fill={`url(#${gradId})`}
                  dot={{ r: 3, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        )
      })}
    </div>
  )
}
