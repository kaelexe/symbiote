import { describe, expect, it } from 'vitest'
import { allowWebGL, renderSize } from './graphicsBudget'

const desktop = { desktopPointer: true, reducedMotion: false, cores: 8, memory: 8 }
describe('optional WebGL budget', () => {
  it('allows capable desktops, including browsers without memory/connection hints', () => {
    expect(allowWebGL(desktop)).toBe(true)
    expect(allowWebGL({ desktopPointer: true, reducedMotion: false })).toBe(true)
  })
  it.each([
    { desktopPointer: false }, { reducedMotion: true }, { saveData: true },
    { cores: 2 }, { memory: 2 }, { effectiveType: 'slow-2g' },
    { effectiveType: '2g' }, { effectiveType: '3g' },
  ])('uses the poster for constrained devices: %j', override => {
    expect(allowWebGL({ ...desktop, ...override })).toBe(false)
  })
  it.each([1, 2, 3, 4])('caps DPR and total pixels at DPR %s', dpr => {
    const normal = renderSize(1920, 1080, dpr)
    const economy = renderSize(1920, 1080, dpr, true)
    expect(normal.width * normal.height).toBeLessThanOrEqual(650_000)
    expect(economy.width * economy.height).toBeLessThanOrEqual(250_000)
    expect(renderSize(100, 100, dpr).width).toBeLessThanOrEqual(125)
  })
  it('handles a temporarily collapsed container', () => {
    expect(renderSize(0, 0, 2)).toEqual({ width: 1, height: 1 })
  })
})
