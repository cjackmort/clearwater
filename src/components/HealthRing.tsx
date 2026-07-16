import { SCORE_COLORS, scoreBand } from '../domain/healthScore'

interface HealthRingProps {
  score: number
  size?: number
  label?: string
}

/** Color ring: red <60, yellow 60–84, green 85+. */
export function HealthRing({ score, size = 148, label = 'Health Score' }: HealthRingProps) {
  const stroke = size / 12
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const color = SCORE_COLORS[scoreBand(clamped)]

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 700ms ease, stroke 700ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {clamped}
        </span>
        <span className="mt-0.5 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
          {label}
        </span>
      </div>
    </div>
  )
}
