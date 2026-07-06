'use client'

import { useEffect, useRef } from 'react'

/**
 * Ambient hero background: short MATLAB syntax tokens drift left to right
 * and morph into their Python equivalent as they cross the glowing
 * "conversion seam" — the same transform the product performs on real code.
 */
const TOKEN_PAIRS: [string, string][] = [
  ['1:n', 'range(n)'],
  ['end', ']'],
  ['A(i,j)', 'A[i,j]'],
  ['function', 'def'],
  ['~=', '!='],
  ['elseif', 'elif'],
  ['zeros(n)', 'np.zeros(n)'],
  ['disp(x)', 'print(x)'],
  ['true', 'True'],
  ['strcat', '+'],
  ['numel(x)', 'len(x)'],
  ['%', '#'],
]

type Token = {
  x: number
  y: number
  speed: number
  pair: [string, string]
  life: number
  maxLife: number
  flashed: boolean
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
    let seamX = 0
    let animId = 0
    const tokens: Token[] = []
    const COUNT = 20

    function mkToken(atStart: boolean): Token {
      return {
        x: atStart ? -Math.random() * 200 : Math.random() * W,
        y: H * 0.16 + Math.random() * H * 0.68,
        speed: Math.random() * 0.35 + 0.28,
        pair: TOKEN_PAIRS[Math.floor(Math.random() * TOKEN_PAIRS.length)],
        life: 0,
        maxLife: Math.random() * 260 + 320,
        flashed: false,
      }
    }

    function resize() {
      if (!canvas) return
      W = canvas.width = canvas.offsetWidth
      H = canvas.height = canvas.offsetHeight
      seamX = W * 0.52
    }

    resize()
    for (let i = 0; i < COUNT; i++) {
      const t = mkToken(false)
      t.life = Math.random() * t.maxLife
      tokens.push(t)
    }

    function drawSeam() {
      if (!ctx) return
      const grd = ctx.createLinearGradient(seamX - 60, 0, seamX + 60, 0)
      grd.addColorStop(0, 'rgba(217,102,43,0)')
      grd.addColorStop(0.5, 'rgba(232,147,95,0.18)')
      grd.addColorStop(1, 'rgba(217,102,43,0)')
      ctx.fillStyle = grd
      ctx.fillRect(seamX - 60, 0, 120, H)
    }

    function drawFrame() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)
      drawSeam()

      ctx.font = "13px 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"
      ctx.textBaseline = 'middle'

      for (const t of tokens) {
        const prog = t.life / t.maxLife
        const fade = prog < 0.12 ? prog / 0.12 : prog > 0.82 ? (1 - prog) / 0.18 : 1
        const crossed = t.x >= seamX
        const label = crossed ? t.pair[1] : t.pair[0]
        const color = crossed ? 'rgba(169,182,201,' : 'rgba(217,102,43,'

        if (crossed && !t.flashed) {
          t.flashed = true
          ctx.save()
          ctx.globalAlpha = 0.5
          ctx.fillStyle = '#f3c9a8'
          ctx.shadowColor = 'rgba(243,201,168,0.9)'
          ctx.shadowBlur = 16
          ctx.beginPath()
          ctx.arc(seamX, t.y, 3.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }

        ctx.globalAlpha = fade * 0.85
        ctx.fillStyle = color + '1)'
        ctx.shadowColor = color + '0.5)'
        ctx.shadowBlur = 5
        ctx.fillText(label, t.x, t.y)
        ctx.shadowBlur = 0

        t.x += t.speed * 1.6
        t.life++
        if (t.life >= t.maxLife || t.x > W + 60) {
          Object.assign(t, mkToken(true))
        }
      }
      ctx.globalAlpha = 1
      animId = requestAnimationFrame(drawFrame)
    }

    window.addEventListener('resize', resize)

    if (reduceMotion) {
      drawSeam()
    } else {
      drawFrame()
    }

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
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
