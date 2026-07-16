interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}

/** Tiny dependency-free SVG sparkline. */
export function Sparkline({ values, width = 96, height = 32, stroke = '#0891b2' }: SparklineProps) {
  if (values.length < 2) {
    return <div style={{ width, height }} className="rounded bg-slate-100" />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 3
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2)
      const y = pad + (1 - (v - min) / span) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const last = values[values.length - 1]
  const lastX = width - pad
  const lastY = pad + (1 - (last - min) / span) * (height - pad * 2)

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} />
    </svg>
  )
}
