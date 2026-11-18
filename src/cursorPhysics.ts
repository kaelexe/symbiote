export interface Point { x: number; y: number }
interface Spring extends Point { vx: number; vy: number }
export interface CursorPhysics {
  mode: 'free' | 'restrained'
  pointer: Point
  head: Spring
  nodes: Spring[]
  time: number
  pointerAt: number
  inputSpeed: number
  speed: number
  agitation: number
  caughtAt: number
  calm: number
  cooldownUntil: number
  tether: number
  tailLength: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const spring = (x: number, y: number): Spring => ({ x, y, vx: 0, vy: 0 })
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export const releaseRadius = (width: number, height: number) => clamp(Math.min(width, height) * 0.13, 65, 115)

export function createCursor(x: number, y: number, now: number): CursorPhysics {
  return {
    mode: 'free', pointer: { x, y }, head: spring(x, y),
    nodes: Array.from({ length: 12 }, () => spring(x, y)),
    time: now, pointerAt: now, inputSpeed: 0, speed: 0, agitation: 0,
    caughtAt: 0, calm: 0, cooldownUntil: now + 0.5, tether: 0, tailLength: 28,
  }
}

export function moveCursor(state: CursorPhysics, x: number, y: number, now: number) {
  // First activation is seeded at the real pointer; event bursts cannot divide by zero.
  const delta = clamp(now - state.pointerAt, 1 / 240, 0.25)
  state.inputSpeed = Math.min(12000, Math.hypot(x - state.pointer.x, y - state.pointer.y) / delta)
  state.pointer.x = x
  state.pointer.y = y
  state.pointerAt = now
}

export function releaseCursor(state: CursorPhysics, now: number) {
  state.mode = 'free'
  state.agitation = 0
  state.calm = 0
  state.speed = 0
  state.inputSpeed = 0
  state.cooldownUntil = now + 2
  Object.assign(state.head, spring(state.pointer.x, state.pointer.y))
  state.nodes.forEach(node => Object.assign(node, spring(state.pointer.x, state.pointer.y)))
}

function integrate(node: Spring, anchor: Point, stiffness: number, damping: number, dt: number) {
  node.vx += ((anchor.x - node.x) * stiffness - node.vx * damping) * dt
  node.vy += ((anchor.y - node.y) * stiffness - node.vy * damping) * dt
  const limit = Math.min(1, 1800 / (Math.hypot(node.vx, node.vy) || 1))
  node.vx *= limit
  node.vy *= limit
  node.x += node.vx * dt
  node.y += node.vy * dt
}

function limitDistance(node: Spring, anchor: Point, maximum: number) {
  const length = distance(node, anchor)
  if (length <= maximum) return
  node.x = anchor.x + (node.x - anchor.x) / length * maximum
  node.y = anchor.y + (node.y - anchor.y) / length * maximum
  node.vx *= 0.6
  node.vy *= 0.6
}

export function stepCursor(state: CursorPhysics, now: number, width: number, height: number) {
  const dt = clamp(now - state.time, 0, 0.05)
  state.time = now
  if (!dt) return
  const age = Math.max(0, now - state.pointerAt)
  const measuredSpeed = state.inputSpeed * Math.exp(-Math.max(0, age - 0.035) / 0.075)
  state.speed += (measuredSpeed - state.speed) * (1 - Math.exp(-18 * dt))
  const center = { x: width / 2, y: height / 2 }
  if (state.mode === 'free') {
    const fast = state.speed > Math.max(1200, Math.min(width, height) * 2.2) && age < 0.12
    state.agitation = now < state.cooldownUntil ? 0 : clamp(state.agitation + dt * (fast ? 3 : -2), 0, 1)
    if (state.agitation >= 1) {
      state.mode = 'restrained'
      state.caughtAt = now
      state.calm = 0
    }
  } else {
    const centered = distance(state.pointer, center) < releaseRadius(width, height)
    const quiet = state.speed < 150 && now - state.caughtAt > 0.6
    state.calm = centered && quiet ? state.calm + dt : 0
    if (state.calm >= 0.7) releaseCursor(state, now)
  }
  const caught = state.mode === 'restrained'
  state.tether += ((caught ? 1 : 0) - state.tether) * (1 - Math.exp(-(caught ? 8 : 6) * dt))
  state.tailLength = 28 + Math.min(92, state.speed * 0.032)
  // Resistance saturates: stronger input strains the ropes, not the entire page.
  const target = caught ? {
    x: center.x + Math.tanh((state.pointer.x - center.x) / 180) * 48,
    y: center.y + Math.tanh((state.pointer.y - center.y) / 180) * 48,
  } : state.pointer
  const steps = Math.ceil(dt / (1 / 120))
  const h = dt / steps
  for (let step = 0; step < steps; step++) {
    integrate(state.head, target, caught ? 220 : 1000, caught ? 29 : 48, h)
    if (!caught) limitDistance(state.head, state.pointer, 24)
    Object.assign(state.nodes[0], state.head)
    for (let i = 1; i < state.nodes.length; i++) {
      const node = state.nodes[i]
      const anchor = state.nodes[i - 1]
      integrate(node, anchor, 380, 30, h)
      // A hard length constraint prevents accumulated spring lag at any input speed.
      limitDistance(node, anchor, state.tailLength / (state.nodes.length - 1))
    }
  }
}
