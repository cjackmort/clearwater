import { useId } from 'react'

interface SparklineProps {
  values: number[]
  height?: number
  stroke?: string
  /** Draw a soft gradient area under the line */
  fill?: boolean
  /** Draw a dot on the most recent point */
  endDot?: boolean
}

/**
 * Tiny dependency-free SVG sparkline. Stretches to fill its container width;
 * strokes stay crisp via vector-effect. Optional gradient area + endpoint dot.
 */
export function Sparkline({
  values,
  height = 28,
  stroke = '#0891b2',
  fill = true,
  endDot = true,
}: SparklineProps) {
  const gradId = useId()
  if (values.length < 2) {
    return <div style={{ height }} className="w-full rounded bg-slate-100" />
  }
  const VB_W = 100
  const VB_H = 100
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const padY = 10
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * VB_W
    const y = padY + (1 - (v - min) / span) * (VB_H - padY * 2)
    return [x, y] as const
  })
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${VB_H} ${line} ${VB_W},${VB_H}`
  const [lastX, lastY] = coords[coords.length - 1]

  return (
    <svg
      className="w-full"
      style={{ height }}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={area} fill={`url(#${gradId})`} />}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {endDot && (
        <circle cx={lastX} cy={lastY} r="2.75" fill={stroke} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  )
}
