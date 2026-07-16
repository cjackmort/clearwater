interface SparklineProps {
  values: number[]
  height?: number
  stroke?: string
}

/**
 * Tiny dependency-free SVG sparkline. Stretches to fill its container width;
 * strokes stay crisp via vector-effect.
 */
export function Sparkline({ values, height = 28, stroke = '#0891b2' }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ height }} className="w-full rounded bg-slate-100" />
  }
  const VB_W = 100
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const padY = 8
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * VB_W
      const y = padY + (1 - (v - min) / span) * (100 - padY * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className="w-full"
      style={{ height }}
      viewBox={`0 0 ${VB_W} 100`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
