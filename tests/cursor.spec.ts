import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Isolate physics from first-load GPU compilation. Concurrent WebGL + pointer
  // behavior is audited in performance.spec.ts after the renderer is ready.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true, value: Object.assign(new EventTarget(), { saveData: true }),
    })
  })
})

async function wave(page: Page) {
  await page.evaluate(async () => {
    const start = performance.now()
    let count = 0
    // Sustained input across real animation frames, not one synthetic teleport.
    while (performance.now() - start < 1300) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: innerWidth * (++count % 2 ? 0.18 : 0.82),
        clientY: innerHeight * 0.43,
        pointerType: 'mouse',
      }))
    }
  })
}

test('idle strands reach subtly, animate without input, and trail again on movement', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Idle strands are for fine hover pointers only.')
  // Stable strand profiles make the pixel-size assertion reproducible.
  await page.addInitScript(() => { Math.random = () => 0.75 })
  await page.goto('/')
  await page.mouse.move(1100, 600)
  const cursor = page.locator('canvas[data-tendril-cursor]')
  const result = await cursor.evaluate(async (element: HTMLCanvasElement) => {
    const context = element.getContext('2d')!
    const dpr = element.width / innerWidth
    const start = performance.now()
    let baseline: Uint8ClampedArray | undefined
    let changes = 0
    let radius = 0
    while (performance.now() - start < 2200) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (performance.now() - start < 1000) continue
      const image = context.getImageData(1074 * dpr, 574 * dpr, 52 * dpr, 52 * dpr)
      baseline ??= image.data.slice()
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const alpha = (y * image.width + x) * 4 + 3
          if (image.data[alpha]) radius = Math.max(radius, Math.hypot(x / dpr - 26, y / dpr - 26))
          if (image.data[alpha] !== baseline[alpha]) changes++
        }
      }
    }
    return { radius, changes }
  })
  expect(result.radius).toBeGreaterThan(11)
  expect(result.radius).toBeLessThan(22)
  expect(result.changes).toBeGreaterThan(0)
  await expect(cursor).toHaveAttribute('data-mode', 'free')
  await page.mouse.move(1200, 600)
  await page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-tendril-cursor]')!
    const dpr = canvas.width / innerWidth
    const pixels = canvas.getContext('2d')!.getImageData(1074 * dpr, 574 * dpr, 52 * dpr, 52 * dpr).data
    return pixels.every((value, i) => i % 4 !== 3 || value === 0)
  })
  await expect(cursor).toHaveAttribute('data-mode', 'free')
})

test('fast waving anchors the visual cursor; calm centered movement releases it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Restraint is for fine hover pointers only.')
  await page.goto('/')
  await wave(page)
  const cursor = page.locator('canvas[data-tendril-cursor]')
  await expect(cursor).toHaveAttribute('data-mode', 'restrained')
  await expect(page.getByRole('status').filter({ hasText: 'The symbiote is holding you.' })).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/tendril-cursor-active/)
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull()
  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height / 2)
  await expect(cursor).toHaveAttribute('data-mode', 'free')
  await expect(page.locator('.cursor-restraint-hint')).toBeHidden()
  await expect(page.locator('html')).toHaveClass(/tendril-cursor-active/)
})

test('restraint never intercepts clicks; Escape immediately releases with cooldown', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Restraint is for fine hover pointers only.')
  await page.goto('/')
  await wave(page)
  const cursor = page.locator('canvas[data-tendril-cursor]')
  await expect(cursor).toHaveAttribute('data-mode', 'restrained')
  const audio = page.getByRole('button', { name: 'Enable ambient audio' })
  await audio.click()
  await expect(page.getByRole('button', { name: 'Mute ambient audio' })).toHaveAttribute('aria-pressed', 'true')
  await expect(cursor).toHaveAttribute('data-mode', 'restrained')
  await page.keyboard.press('Escape')
  await expect(cursor).toHaveAttribute('data-mode', 'free')
  await wave(page)
  await expect(cursor).toHaveAttribute('data-mode', 'free')
})

test('touch and reduced-motion users cannot enter restraint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await wave(page)
  await expect(page.locator('canvas[data-tendril-cursor]')).toBeHidden()
  await expect(page.locator('.cursor-restraint-hint')).toBeHidden()
  await expect(page.locator('html')).not.toHaveClass(/tendril-cursor-active/)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 300, pointerType: 'touch' })))
  await expect(page.locator('html')).not.toHaveClass(/tendril-cursor-active/)
})

test('leaving the page, resize, and keyboard navigation restore the native pointer', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Restraint is for fine hover pointers only.')
  await page.goto('/')
  await wave(page)
  const cursor = page.locator('canvas[data-tendril-cursor]')
  await expect(cursor).toHaveAttribute('data-mode', 'restrained')
  await page.keyboard.press('Tab')
  await expect(cursor).toHaveAttribute('data-mode', 'idle')
  await expect(page.locator('html')).not.toHaveClass(/tendril-cursor-active/)
  await expect(page.locator('.cursor-restraint-hint')).toBeHidden()
  await page.mouse.move(300, 300)
  await expect(cursor).toHaveAttribute('data-mode', 'free')
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(cursor).toHaveAttribute('data-mode', 'idle')
  await page.mouse.move(350, 350)
  await expect(cursor).toHaveAttribute('data-mode', 'free')
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(cursor).toHaveAttribute('data-mode', 'idle')
})

test('Retina cursor uses CSS pixels, sleeps completely, and wakes on input', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Fine pointer overlay only.')
  // Context DPR is 2, but the cursor must not allocate a Retina backing store.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2 })
    const nativeClear = CanvasRenderingContext2D.prototype.clearRect
    const audit = { clears: 0, area: 0 }
    Object.assign(window, { cursorAudit: audit })
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
      if (this.canvas.hasAttribute('data-tendril-cursor')) {
        audit.clears++
        audit.area += width * height
      }
      return nativeClear.call(this, x, y, width, height)
    }
  })
  await page.goto('/')
  const cursor = page.locator('canvas[data-tendril-cursor]')
  await page.mouse.move(1100, 600)
  expect(await cursor.evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([1440, 1000])
  await expect(cursor).toHaveAttribute('data-animation', 'sleeping', { timeout: 10000 })
  const before = await page.evaluate(() => (window as unknown as { cursorAudit: { clears: number } }).cursorAudit.clears)
  // Sample across real frames: sleeping must not clear/redraw at all.
  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  })
  expect(await page.evaluate(() => (window as unknown as { cursorAudit: { clears: number } }).cursorAudit.clears)).toBe(before)
  await page.mouse.move(1110, 610)
  await expect(cursor).toHaveAttribute('data-animation', 'running')
  await page.waitForFunction(previous => (window as unknown as { cursorAudit: { clears: number } }).cursorAudit.clears > previous, before)
  const area = await page.evaluate(() => {
    const audit = (window as unknown as { cursorAudit: { clears: number; area: number } }).cursorAudit
    return audit.area / audit.clears
  })
  expect(area).toBeLessThan(1440 * 1000 * 0.05)
  // Pointerdown also wakes the click spike after idle, without a move.
  await expect(cursor).toHaveAttribute('data-animation', 'sleeping', { timeout: 10000 })
  await page.mouse.down()
  await expect(cursor).toHaveAttribute('data-animation', 'running')
  await page.mouse.up()
})
