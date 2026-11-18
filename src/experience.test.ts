import { describe, expect, it } from 'vitest'
import { scrollChapter } from './experience'

describe('chapter navigation', () => {
  const bounds = [{ top: 0, height: 680 }, { top: 680, height: 900 }, { top: 1580, height: 1000 }, { top: 2580, height: 1723 }]
  it.each([[0, 0], [680, 1], [1580, 2], [2580, 3], [4000, 3], [-100, 0]])('maps scroll %s to chapter %s using actual section positions', (scroll, chapter) => {
    expect(scrollChapter(bounds, scroll, 654)).toBe(chapter)
  })
  it('activates the chapter as it crosses the reading area', () => {
    expect(scrollChapter(bounds, 680 - 800 * 0.42 - 1, 800)).toBe(0)
    expect(scrollChapter(bounds, 680 - 800 * 0.42, 800)).toBe(1)
  })
  it('handles missing and zero-height sections', () => {
    expect(scrollChapter([], 0, 800)).toBe(0)
    expect(scrollChapter([{ top: 0, height: 0 }], 0, 800)).toBe(0)
  })
})
