export type Trait = 'weaponry' | 'webbing' | 'stealth'
export interface SectionBounds { top: number; height: number }

export function scrollChapter(bounds: readonly SectionBounds[], scroll: number, viewportHeight: number) {
  return Math.max(0, bounds.findLastIndex(section => scroll + viewportHeight * 0.42 >= section.top))
}
