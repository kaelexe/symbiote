import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function capableDesktop(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true })
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true })
    const state = window as Window & { modelDraws?: number }
    state.modelDraws = 0
    const original = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      state.modelDraws!++
      return original.apply(this, args)
    }
  })
}
async function drawCount(page: Page) {
  return page.evaluate(() => (window as Window & { modelDraws: number }).modelDraws)
}
async function animationFrames(page: Page, count = 10) {
  await page.evaluate(async count => {
    for (let i = 0; i < count; i++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }, count)
}

test('eligible desktop respects geometry, draw-call, resolution, and frame-rate budgets; pauses offscreen and hidden', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Desktop-only rendering; mobile uses the poster.')
  await capableDesktop(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const modelResponse = page.waitForResponse('**/models/symbiote-web.glb')
  await page.goto('/')
  const host = page.locator('.specimen-visual')
  const canvas = page.locator('canvas[data-symbiote-canvas]')
  await expect(host).toHaveAttribute('data-state', 'ready')
  await expect(canvas).toHaveAttribute('data-triangles', '29608')
  await expect(canvas).toHaveAttribute('data-draw-calls', '9')
  expect((await (await modelResponse).body()).byteLength).toBeLessThanOrEqual(450_000)
  expect(await canvas.evaluate((canvas: HTMLCanvasElement) => canvas.width * canvas.height)).toBeLessThanOrEqual(650_000)
  expect(await canvas.evaluate((canvas: HTMLCanvasElement) => {
    const attributes = canvas.getContext('webgl2')!.getContextAttributes()!
    return { powerPreference: attributes.powerPreference, antialias: attributes.antialias, stencil: attributes.stencil, depth: attributes.depth }
  })).toEqual({ powerPreference: 'high-performance', antialias: true, stencil: false, depth: true })
  const frames = await page.evaluate(async () => {
    const state = window as Window & { modelDraws: number }
    const start = performance.now(), before = state.modelDraws
    while (performance.now() - start < 1000) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    return (state.modelDraws - before) / 9
  })
  expect(frames).toBeGreaterThan(0)
  expect(frames).toBeLessThanOrEqual(34)
  await page.evaluate(() => window.scrollTo({ top: document.getElementById('logs')!.offsetTop, behavior: 'instant' }))
  await expect(host).toHaveAttribute('data-state', 'paused')
  const offscreen = await drawCount(page)
  await animationFrames(page)
  expect(await drawCount(page)).toBe(offscreen)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(host).toHaveAttribute('data-state', 'ready')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(host).toHaveAttribute('data-state', 'paused')
  const hidden = await drawCount(page)
  await animationFrames(page)
  expect(await drawCount(page)).toBe(hidden)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(host).toHaveAttribute('data-state', 'ready')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(canvas).toHaveCount(0)
  await expect(host).toHaveAttribute('data-state', 'poster')
  expect(errors).toEqual([])
})

test('mobile and save-data visitors never download the renderer or model', async ({ page, isMobile }) => {
  if (!isMobile) await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true, value: Object.assign(new EventTarget(), { saveData: true, effectiveType: '4g' }),
    })
  })
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/')
  const image = page.locator('.specimen-visual img')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await animationFrames(page)
  await expect(page.locator('canvas[data-symbiote-canvas]')).toHaveCount(0)
  expect(requests.filter(url => /symbioteRenderer|symbiote-web\.glb|\/three[/.]/.test(url))).toEqual([])
})

test('landing below the hero defers all 3D downloads until the hero becomes visible', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile always uses the poster.')
  await capableDesktop(page)
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.goto('/#logs')
  await expect(page.getByRole('heading', { name: /THE ORGANISM/ })).toBeInViewport()
  await animationFrames(page)
  expect(requests.filter(url => /symbioteRenderer|symbiote-web\.glb/.test(url))).toEqual([])
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'ready')
})

test('context loss falls back without affecting navigation or retrying the GPU', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile never creates a WebGL context.')
  await capableDesktop(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'ready')
  await page.locator('canvas[data-symbiote-canvas]').evaluate(canvas => canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })))
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'poster')
  await expect(page.locator('canvas[data-symbiote-canvas]')).toHaveCount(0)
  await expect(page.locator('.specimen-visual img')).toHaveCSS('opacity', '1')
  await page.getByRole('navigation', { name: 'Chapters', exact: true }).getByRole('link', { name: /Physiology/ }).click()
  await expect(page.getByRole('button', { name: /Organic webbing/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('denied WebGL or a missing model keeps the static fallback and readable HTML', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile never creates a WebGL context.')
  await capableDesktop(page)
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type.startsWith('webgl')) throw new Error('Context denied by test')
        return Reflect.apply(original, this, [type, ...args])
      },
    })
  })
  const loaded = page.waitForResponse('**/models/symbiote-web.glb')
  await page.goto('/')
  await loaded
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'poster')
  await expect(page.locator('canvas[data-symbiote-canvas]')).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('VENOM')
  await expect(page.getByRole('link', { name: 'Explore the organism' })).toBeVisible()
  await page.route('**/models/symbiote-web.glb', route => route.fulfill({ status: 404, body: '' }))
  const missing = page.waitForResponse('**/models/symbiote-web.glb')
  await page.reload()
  await missing
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'poster')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('sustained slow frames lower quality, then relinquish WebGL entirely', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mobile never creates a WebGL context.')
  await capableDesktop(page)
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      // Emulate expensive rendering in this test page only.
      const start = performance.now()
      while (performance.now() - start < 3) { /* Simulated slow GPU/driver submission. */ }
      return original.apply(this, args)
    }
  })
  await page.goto('/')
  const canvas = page.locator('canvas[data-symbiote-canvas]')
  await expect(canvas).toHaveAttribute('data-fps', '24')
  expect(await canvas.evaluate((canvas: HTMLCanvasElement) => canvas.width * canvas.height)).toBeLessThanOrEqual(250_000)
  await expect(canvas).toHaveCount(0)
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'poster')
  await expect(page.locator('.specimen-visual img')).toHaveCSS('opacity', '1')
})
