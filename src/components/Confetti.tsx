import { useEffect, useRef } from 'react'

interface ConfettiProps {
  /** Called once the burst has finished animating */
  onDone?: () => void
}

const COLORS = ['#06b6d4', '#34d399', '#fbbf24', '#f472b6', '#818cf8', '#ffffff']

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  color: string
}

/**
 * A one-shot confetti burst rendered on a full-screen canvas overlay.
 * Self-cleans and calls onDone when the animation completes. No dependencies.
 */
export function Confetti({ onDone }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      onDone?.()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    // Two launch points (lower-left + lower-right) firing upward and inward.
    const particles: Particle[] = []
    const spawn = (originX: number, dir: number) => {
      for (let i = 0; i < 55; i++) {
        particles.push({
          x: originX,
          y: H * 0.35,
          vx: dir * (2 + Math.random() * 5),
          vy: -(6 + Math.random() * 7),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          size: 5 + Math.random() * 6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        })
      }
    }
    spawn(W * 0.2, 1)
    spawn(W * 0.8, -1)

    const gravity = 0.22
    const start = performance.now()
    const duration = 2200
    let raf = 0

    const frame = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, W, H)
      const fade = Math.max(0, 1 - elapsed / duration)
      for (const p of particles) {
        p.vy += gravity
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (elapsed < duration) {
        raf = requestAnimationFrame(frame)
      } else {
        ctx.clearRect(0, 0, W, H)
        onDone?.()
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-dvh w-full"
    />
  )
}
