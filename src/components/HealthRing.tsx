import { useEffect, useState } from 'react'
import { scoreBand } from '../domain/healthScore'

interface HealthRingProps {
  score: number
  size?: number
  label?: string
  /** Render for a colored (gradient) background — uses white track + text */
  onColor?: boolean
}

/** Gradient stops per band, plus a human word for the band. */
const BAND_GRADIENT: Record<string, [string, string]> = {
  green: ['#34d399', '#0d9488'],
  yellow: ['#fbbf24', '#f97316'],
  red: ['#fb7185', '#e11d48'],
}
const BAND_WORD: Record<string, string> = {
  green: 'Excellent',
  yellow: 'Balancing',
  red: 'Needs work',
}

/** Animated color ring: red <60, yellow 60–84, green 85+. */
export function HealthRing({ score, size = 128, label = 'Health Score', onColor = false }: HealthRingProps) {
  const stroke = size / 13
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const band = scoreBand(clamped)
  const [from, to] = BAND_GRADIENT[band]
  const gradId = `ring-${band}`

  // Animate the ring drawing and the number counting up on mount / change.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const startVal = shown
    const duration = 900
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(startVal + (clamped - startVal) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped])

  const numberColor = onColor ? '#ffffff' : to
  const wordColor = onColor ? 'rgba(255,255,255,0.85)' : from

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={onColor ? '#ffffff' : from} />
            <stop offset="100%" stopColor={onColor ? 'rgba(255,255,255,0.75)' : to} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={onColor ? 'rgba(255,255,255,0.25)' : '#e2e8f0'}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-bold tabular-nums"
          style={{ color: numberColor, fontSize: size * 0.28, lineHeight: 1.05 }}
        >
          {shown}
        </span>
        <span
          className="font-semibold tracking-wide uppercase"
          style={{ fontSize: Math.max(8.5, size * 0.066), color: wordColor }}
        >
          {onColor ? BAND_WORD[band] : label}
        </span>
      </div>
    </div>
  )
}
