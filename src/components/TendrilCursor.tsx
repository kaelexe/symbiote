import { useEffect, useRef } from 'react'
import { createCursor, moveCursor, releaseCursor, releaseRadius, stepCursor } from '../cursorPhysics'

const anchors = [[0, 0.12], [0, 0.37], [0, 0.67], [0, 0.92], [1, 0.09], [1, 0.34], [1, 0.65], [1, 0.9]]

export default function TendrilCursor({ reducedMotion }: { reducedMotion: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const calmBar = useRef<HTMLSpanElement>(null)
  const hint = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = canvas.current
    if (!element || reducedMotion) return
    const context = element.getContext('2d')
    if (!context) return
    const media = matchMedia('(hover: hover) and (pointer: fine)')
    let frame = 0
    let active = false
    let width = innerWidth
    let height = innerHeight
    let burst = 0
    let idleReach = 0
    let lastTime = 0
    let lastDraw = 0
    let dirty: { x: number; y: number; width: number; height: number } | null = null
    let model = createCursor(width / 2, height / 2, performance.now() / 1000)
    let displayedMode = 'idle'
    let animation = ''
    let displayedCalm = -1
    const setAnimation = (value: 'running' | 'sleeping') => {
      if (animation === value) return
      animation = value
      element.dataset.animation = value
    }
    // Pick each strand's shape once, not every frame, for natural spacing without flicker.
    const strands = Array.from({ length: 6 }, () => ({
      phase: Math.random() * Math.PI * 2,
      radius: 3.5 + Math.random() * 4.5,
      curl: 0.2 + Math.random() * 0.3,
      length: 8 + Math.floor(Math.random() * 5),
      reach: 9 + Math.random() * 9,
      pace: 0.7 + Math.random() * 0.7,
    }))
    const syncMode = () => {
      const mode = active ? model.mode : 'idle'
      if (mode === displayedMode) return
      displayedMode = mode
      element.dataset.mode = mode
      if (hint.current) hint.current.hidden = mode !== 'restrained'
      // During restraint the native pointer is visible at the real click target.
      document.documentElement.classList.toggle('tendril-cursor-active', mode === 'free')
    }
    const deactivate = () => {
      active = false
      idleReach = 0
      cancelAnimationFrame(frame)
      frame = 0
      setAnimation('sleeping')
      if (dirty) context.clearRect(dirty.x, dirty.y, dirty.width, dirty.height)
      dirty = null
      syncMode()
    }
    const resize = () => {
      deactivate()
      width = innerWidth; height = innerHeight
      // Soft strands do not benefit from a Retina-sized full-screen backing store.
      element.width = width
      element.height = height
      context.setTransform(1, 0, 0, 1, 0, 0)
    }
    const stroke = (thickness: number, alpha = 1) => {
      context.strokeStyle = `rgba(165,169,181,${0.48 * alpha})`
      context.lineWidth = thickness + 1.15
      context.stroke()
      context.strokeStyle = `rgba(3,3,5,${alpha})`
      context.lineWidth = thickness
      context.stroke()
    }
    const render = (milliseconds: number) => {
      frame = 0
      if (!active) return
      if (milliseconds - lastDraw < 1000 / 60) {
        frame = requestAnimationFrame(render)
        return
      }
      lastDraw = milliseconds - ((milliseconds - lastDraw) % (1000 / 60))
      const now = milliseconds / 1000
      const dt = Math.min(Math.max(now - lastTime, 0), 0.05)
      lastTime = now
      stepCursor(model, now, width, height)
      syncMode()
      burst = Math.max(0, burst - dt * 2.7)
      if (dirty) context.clearRect(dirty.x, dirty.y, dirty.width, dirty.height)
      context.lineCap = 'round'
      context.lineJoin = 'round'
      const { head, pointer, nodes, tether } = model
      if (tether > 0.015) dirty = { x: 0, y: 0, width, height }
      else {
        // Repaint just the moving weave; only edge-anchored ropes need the whole layer.
        const margin = burst > 0 ? 72 : 25
        const xs = [pointer.x, head.x, ...nodes.map(node => node.x)]
        const ys = [pointer.y, head.y, ...nodes.map(node => node.y)]
        const x = Math.floor(Math.min(...xs) - margin), y = Math.floor(Math.min(...ys) - margin)
        dirty = { x, y, width: Math.ceil(Math.max(...xs) + margin - x), height: Math.ceil(Math.max(...ys) + margin - y) }
      }
      const resting = model.mode === 'free' && tether < 0.05 && model.speed < 20 && now - model.pointerAt > 0.35
      idleReach += ((resting ? 1 : 0) - idleReach) * (1 - Math.exp(-dt * (resting ? 3 : 16)))

      if (tether > 0.015) {
        const struggle = Math.min(1, model.speed / 2400)
        anchors.forEach(([x, y], index) => {
          const reach = Math.min(1, tether * 1.6)
          const tip = { x: head.x + (x * width - head.x) * reach, y: head.y + (y * height - head.y) * reach }
          const vibration = Math.sin(now * 31 + index * 2.7) * struggle * 6
          const slack = (1 - struggle) * 28
          context.beginPath()
          context.moveTo(tip.x, tip.y)
          context.bezierCurveTo(
            tip.x + (head.x - tip.x) * 0.34, tip.y + slack + vibration,
            head.x + (tip.x - head.x) * 0.26, head.y - vibration,
            head.x, head.y,
          )
          stroke((index % 3 === 0 ? 5 : 2.2) * tether, tether * 0.95)
          // Split roots visibly cling to the page edge.
          for (const branch of [-1, 1]) {
            context.beginPath()
            context.moveTo(tip.x, tip.y + branch * 24 * tether)
            context.quadraticCurveTo(tip.x + (head.x - tip.x) * 0.06, tip.y + branch * 8, tip.x + (head.x - tip.x) * 0.15, tip.y + (head.y - tip.y) * 0.13)
            stroke(1.2 * tether, tether * 0.6)
          }
        })
        if (model.mode === 'restrained') {
          const radius = releaseRadius(width, height)
          context.beginPath()
          context.setLineDash([3, 9])
          context.arc(width / 2, height / 2, radius, 0, Math.PI * 2)
          context.strokeStyle = '#ff36364d'
          context.lineWidth = 1
          context.stroke()
          context.setLineDash([])
          context.beginPath()
          context.arc(width / 2, height / 2, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, model.calm / 0.7))
          context.strokeStyle = '#f5f5f5b3'
          context.stroke()
        }
      }

      // A close, irregular weave rather than a broad, evenly spaced fan.
      strands.forEach((strand, index) => {
        // Strand-wide terms are constant across its points for this frame.
        const feelAngle = strand.phase + Math.sin(now * 0.4 + strand.phase) * 0.28
        const feelX = Math.cos(feelAngle), feelY = Math.sin(feelAngle)
        const reach = strand.reach * (0.65 + 0.35 * (0.5 + Math.sin(now * strand.pace + strand.phase) * 0.5))
        const bendFactor = Math.sin(now * 0.8 + strand.phase) * 2.5
        context.beginPath()
        nodes.forEach((node, i) => {
          if (i >= strand.length) return
          const t = i / (nodes.length - 1)
          const spread = Math.sin(t * Math.PI) * strand.radius
          const angle = strand.phase + i * strand.curl + now * 0.7
          const trailingX = node.x + Math.cos(angle) * spread
          const trailingY = node.y + Math.sin(angle) * spread
          // While resting, each tip slowly feels outward on its own short cycle.
          // Only the drawing changes: idle motion cannot trigger restraint or shift clicks.
          const reachT = i / (strand.length - 1)
          const bend = Math.sin(reachT * Math.PI) * bendFactor
          const restingX = head.x + feelX * reach * reachT - feelY * bend
          const restingY = head.y + feelY * reach * reachT + feelX * bend
          const x = trailingX + (restingX - trailingX) * idleReach
          const y = trailingY + (restingY - trailingY) * idleReach
          if (!i) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        stroke(index === 0 ? 2.8 : 0.9)
      })
      if (burst > 0) {
        for (let i = 0; i < 9; i++) {
          const angle = i / 9 * Math.PI * 2
          const length = (1 - burst) * 55 + 12
          context.beginPath()
          context.moveTo(head.x, head.y)
          context.quadraticCurveTo(head.x + Math.cos(angle + 0.35) * length * 0.5, head.y + Math.sin(angle + 0.35) * length * 0.5, head.x + Math.cos(angle) * length, head.y + Math.sin(angle) * length)
          context.strokeStyle = `rgba(170,40,40,${burst * 0.8})`
          context.lineWidth = burst * 2
          context.stroke()
        }
      }
      context.beginPath()
      context.arc(head.x, head.y, 4 + tether * 6, 0, Math.PI * 2)
      context.fillStyle = '#030303'
      context.fill()
      context.strokeStyle = `rgba(200,200,210,${0.5 + tether * 0.3})`
      context.lineWidth = 0.7
      context.stroke()
      if (model.mode === 'free') {
        // Exact aiming point: physics never changes what a click activates.
        context.beginPath()
        context.arc(pointer.x, pointer.y, 2, 0, Math.PI * 2)
        context.fillStyle = '#ff3636'
        context.fill()
      }
      const calm = Math.min(1, model.calm / 0.7)
      if (calmBar.current && calm !== displayedCalm) {
        displayedCalm = calm
        calmBar.current.style.transform = `scaleX(${calm})`
      }
      // Keep the approved short idle-reaching flourish, then freeze its last pose.
      // No polling timer or RAF remains once physics settles. Input wakes immediately.
      const settled = model.mode === 'free' && now - model.pointerAt > 3.2
        && model.speed < 0.1 && tether < 0.001 && burst === 0
        && [head, ...nodes].every(node => Math.hypot(node.vx, node.vy) < 0.5)
      setAnimation(settled ? 'sleeping' : 'running')
      if (!settled) frame = requestAnimationFrame(render)
    }
    const wake = (now: number) => {
      if (frame) return
      lastTime = now
      model.time = now
      setAnimation('running')
      frame = requestAnimationFrame(render)
    }
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType === 'touch') { deactivate(); return }
      const now = performance.now() / 1000
      if (!active) {
        model = createCursor(event.clientX, event.clientY, now)
        active = true
        syncMode()
      } else moveCursor(model, event.clientX, event.clientY, now)
      wake(now)
    }
    const click = (event: PointerEvent) => {
      if (active && media.matches && event.pointerType !== 'touch') {
        burst = 1
        wake(performance.now() / 1000)
      }
    }
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && active) {
        releaseCursor(model, performance.now() / 1000)
        syncMode()
        wake(performance.now() / 1000)
      } else if (event.key === 'Tab') deactivate()
    }
    const visibility = () => { if (document.hidden) deactivate() }
    const mediaChange = () => { if (!media.matches) deactivate() }
    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', click, { passive: true })
    window.addEventListener('keydown', keyboard)
    window.addEventListener('blur', deactivate)
    document.addEventListener('pointerleave', deactivate)
    document.addEventListener('visibilitychange', visibility)
    media.addEventListener('change', mediaChange)
    return () => {
      deactivate()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', click)
      window.removeEventListener('keydown', keyboard)
      window.removeEventListener('blur', deactivate)
      document.removeEventListener('pointerleave', deactivate)
      document.removeEventListener('visibilitychange', visibility)
      media.removeEventListener('change', mediaChange)
    }
  }, [reducedMotion])

  return (
    <>
      <canvas ref={canvas} data-tendril-cursor data-mode="idle" aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60, display: reducedMotion ? 'none' : 'block' }} />
        <div ref={hint} hidden className="cursor-restraint-hint" role="status">
          <strong>The symbiote is holding you.</strong>
          <span>Move to the center. Slow down to break free.</span>
          <small>Esc releases immediately. Your normal pointer still works.</small>
          <span className="cursor-calm-track" aria-hidden="true"><span ref={calmBar} /></span>
        </div>
    </>
  )
}
