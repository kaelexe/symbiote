import { describe, expect, it } from 'vitest'
import { createCursor, moveCursor, releaseCursor, stepCursor } from './cursorPhysics'

const width = 1440
const height = 1000
function wave(state: ReturnType<typeof createCursor>, seconds = 1.5, fps = 60) {
  const start = state.time
  for (let i = 1; i <= seconds * fps; i++) {
    const now = start + i / fps
    moveCursor(state, i % 2 ? 200 : 1200, 430, now)
    stepCursor(state, now, width, height)
  }
}

describe('tendril cursor physics', () => {
  it('keeps slow movement short and does not capture ordinary hovering', () => {
    const state = createCursor(100, 200, 0)
    for (let i = 1; i <= 240; i++) {
      moveCursor(state, 100 + i / 3, 200, i / 60)
      stepCursor(state, i / 60, width, height)
    }
    expect(state.mode).toBe('free')
    expect(state.tailLength).toBeLessThan(32)
    expect(Math.hypot(state.pointer.x - state.nodes.at(-1)!.x, state.pointer.y - state.nodes.at(-1)!.y)).toBeLessThan(56)
  })
  it('does not mistake one teleport or a first input for sustained waving', () => {
    const state = createCursor(100, 200, 0)
    stepCursor(state, 1, width, height)
    moveCursor(state, 1300, 200, 1)
    for (let i = 1; i <= 120; i++) stepCursor(state, 1 + i / 60, width, height)
    expect(state.mode).toBe('free')
  })
  it('anchors after sustained fast motion and resists an off-center pointer', () => {
    const state = createCursor(200, 430, 0)
    wave(state)
    expect(state.mode).toBe('restrained')
    wave(state, 1)
    expect(Math.abs(state.head.x - width / 2)).toBeLessThan(75)
    expect(state.tether).toBeGreaterThan(0.95)
    for (let i = 1; i <= 180; i++) stepCursor(state, 2.5 + i / 60, width, height)
    expect(state.mode).toBe('restrained') // Stillness alone, away from center, is not release.
  })
  it('releases only after the pointer is centered and calm, then applies cooldown', () => {
    const state = createCursor(200, 430, 0)
    wave(state)
    moveCursor(state, width / 2, height / 2, 1.5)
    for (let i = 1; i <= 120; i++) stepCursor(state, 1.5 + i / 60, width, height)
    expect(state.mode).toBe('free')
    expect(state.cooldownUntil).toBeGreaterThan(state.time)
    wave(state, 0.25)
    expect(state.mode).toBe('free')
  })
  it('supports immediate Escape release without relocking on the next event', () => {
    const state = createCursor(200, 430, 0)
    wave(state)
    releaseCursor(state, state.time)
    expect(state.mode).toBe('free')
    expect(state.head.x).toBe(state.pointer.x)
    wave(state, 0.5)
    expect(state.mode).toBe('free')
  })
  it.each([30, 60, 120])('bounds every tail link and stays finite under extreme input at %s FPS', fps => {
    const state = createCursor(200, 430, 0)
    wave(state, 3, fps)
    expect(state.mode).toBe('restrained')
    for (let i = 1; i < state.nodes.length; i++) {
      const a = state.nodes[i - 1]
      const b = state.nodes[i]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(120 / 11 + 0.00001)
      expect(Number.isFinite(b.x + b.y + b.vx + b.vy)).toBe(true)
    }
    stepCursor(state, 600, width, height)
    moveCursor(state, 100, 100, 600)
    moveCursor(state, 1300, 900, 600)
    stepCursor(state, 600 + 1 / 60, width, height)
    expect(Number.isFinite(state.head.x + state.head.y + state.speed)).toBe(true)
  })
})
