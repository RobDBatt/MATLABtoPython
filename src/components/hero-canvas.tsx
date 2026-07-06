'use client'

import { useEffect, useRef } from 'react'

/**
 * Hero centerpiece: a large ".m" is sampled into particles, which scatter
 * and reform as ".py", hold, then scatter and reform back — the literal
 * transform the product performs, as the dominant visual instead of copy.
 */

type Point = { x: number; y: number }

type Particle = {
  m: Point
  py: Point
  jitterSeed: number
  scatterA: Point
  scatterB: Point
}

const CYCLE_MS = 7000
// Phase boundaries as fractions of one cycle.
const P = {
  holdMEnd: 0.18,
  toScatterAEnd: 0.32,
  toPyEnd: 0.48,
  holdPyEnd: 0.68,
  toScatterBEnd: 0.82,
  toMEnd: 1.0,
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function samplePoints(text: string, w: number, h: number, fontPx: number): Point[] {
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const octx = off.getContext('2d')
  if (!octx) return []
  octx.clearRect(0, 0, w, h)
  octx.fillStyle = '#fff'
  octx.font = `700 ${fontPx}px 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace`
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  octx.fillText(text, w / 2, h / 2)

  const { data } = octx.getImageData(0, 0, w, h)
  const step = Math.max(2, Math.round(fontPx / 42))
  const pts: Point[] = []
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y })
    }
  }
  return pts
}

function equalize(a: Point[], b: Point[]): [Point[], Point[]] {
  const n = Math.max(a.length, b.length, 1)
  const outA = Array.from({ length: n }, (_, i) => a[i % (a.length || 1)] ?? { x: 0, y: 0 })
  const outB = Array.from({ length: n }, (_, i) => b[i % (b.length || 1)] ?? { x: 0, y: 0 })
  return [outA, outB]
}

function randScatter(from: Point, w: number, h: number): Point {
  const angle = Math.random() * Math.PI * 2
  const dist = 40 + Math.random() * 160
  return {
    x: Math.min(w, Math.max(0, from.x + Math.cos(angle) * dist)),
    y: Math.min(h, Math.max(0, from.y + Math.sin(angle) * dist)),
  }
}

export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let W = 0
    let H = 0
    let animId = 0
    let particles: Particle[] = []
    let startTime = 0

    function build() {
      if (!canvas) return
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      if (w < 10 || h < 10) return // layout not settled yet; wait for the next observed resize
      W = canvas.width = w
      H = canvas.height = h

      const fontPx = Math.min(H * 0.62, W * 0.24)
      const cx = W * 0.66
      const cy = H * 0.5

      // Sample glyphs into their own tight offscreen box, then place at (cx, cy).
      const boxW = Math.min(W, fontPx * 4)
      const boxH = Math.min(H, fontPx * 1.4)
      const mPts = samplePoints('.m', boxW, boxH, fontPx).map(p => ({
        x: p.x - boxW / 2 + cx,
        y: p.y - boxH / 2 + cy,
      }))
      const pyPts = samplePoints('.py', boxW, boxH, fontPx * 0.72).map(p => ({
        x: p.x - boxW / 2 + cx,
        y: p.y - boxH / 2 + cy,
      }))

      const [eqM, eqPy] = equalize(mPts, pyPts)
      particles = eqM.map((m, i) => ({
        m,
        py: eqPy[i],
        jitterSeed: Math.random() * Math.PI * 2,
        scatterA: randScatter(m, W, H),
        scatterB: randScatter(eqPy[i], W, H),
      }))
    }

    function lerp(a: Point, b: Point, t: number): Point {
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }

    function drawStatic() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = 'rgba(217,102,43,0.85)'
      for (const p of particles) ctx.fillRect(p.m.x, p.m.y, 1.6, 1.6)
    }

    function frame(t: number) {
      if (!ctx) return
      if (!startTime) startTime = t
      const elapsed = (t - startTime) % CYCLE_MS
      const cycle = elapsed / CYCLE_MS

      ctx.clearRect(0, 0, W, H)

      for (const particle of particles) {
        let pos: Point
        let pyness: number // 0 = orange (.m), 1 = blue-grey (.py)
        const idleJ = (phase: number) => ({
          x: Math.sin(phase + particle.jitterSeed) * 1.4,
          y: Math.cos(phase * 1.3 + particle.jitterSeed) * 1.4,
        })

        if (cycle < P.holdMEnd) {
          const j = idleJ(t * 0.002)
          pos = { x: particle.m.x + j.x, y: particle.m.y + j.y }
          pyness = 0
        } else if (cycle < P.toScatterAEnd) {
          const local = (cycle - P.holdMEnd) / (P.toScatterAEnd - P.holdMEnd)
          pos = lerp(particle.m, particle.scatterA, easeInOut(local))
          pyness = local * 0.3
        } else if (cycle < P.toPyEnd) {
          const local = (cycle - P.toScatterAEnd) / (P.toPyEnd - P.toScatterAEnd)
          pos = lerp(particle.scatterA, particle.py, easeInOut(local))
          pyness = 0.3 + local * 0.7
        } else if (cycle < P.holdPyEnd) {
          const j = idleJ(t * 0.002)
          pos = { x: particle.py.x + j.x, y: particle.py.y + j.y }
          pyness = 1
        } else if (cycle < P.toScatterBEnd) {
          const local = (cycle - P.holdPyEnd) / (P.toScatterBEnd - P.holdPyEnd)
          pos = lerp(particle.py, particle.scatterB, easeInOut(local))
          pyness = 1 - local * 0.3
        } else {
          const local = (cycle - P.toScatterBEnd) / (P.toMEnd - P.toScatterBEnd)
          pos = lerp(particle.scatterB, particle.m, easeInOut(local))
          pyness = 0.7 - local * 0.7
        }

        const r = Math.round(217 + (169 - 217) * pyness)
        const g = Math.round(102 + (182 - 102) * pyness)
        const b = Math.round(43 + (201 - 43) * pyness)
        ctx.fillStyle = `rgba(${r},${g},${b},0.8)`
        ctx.fillRect(pos.x, pos.y, 1.8, 1.8)
      }

      animId = requestAnimationFrame(frame)
    }

    // ResizeObserver fires once immediately with the current box size, then
    // again whenever it actually changes — more reliable than the window
    // 'resize' event, which never fires for layout settling / font swaps
    // that change this element's size without the viewport changing.
    const ro = new ResizeObserver(() => {
      build()
      if (particles.length === 0) return
      if (reduceMotion) drawStatic()
      else if (!animId) animId = requestAnimationFrame(frame)
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
