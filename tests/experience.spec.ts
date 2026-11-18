import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function enterChapter(page: Page, id: string) {
  await page.evaluate(id => {
    const section = document.getElementById(id)!
    window.scrollTo({ top: section.offsetTop, behavior: 'instant' })
  }, id)
  await expect(page.locator(`.desktop-nav a[href="#${id}"]`)).toHaveAttribute('aria-current', 'location')
}

test('renders all chapters with local fonts and no WebGL requests in reduced-motion mode', async ({ page }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', request => requests.push(request.url()))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // The lightweight fallback must never even request a WebGL context.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type.startsWith('webgl') || type === 'experimental-webgl') throw new Error('Unexpected WebGL request')
        return Reflect.apply(original, this, [type, ...args])
      },
    })
  })
  await page.goto('/')
  await expect(page.locator('canvas[data-engine]')).toHaveCount(0)
  await expect(page.locator('.scene-layer, .fallback-organism, .render-notice')).toHaveCount(0)
  await expect(page.locator('main > section')).toHaveCount(4)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('VENOM')
  await expect.poll(() => page.evaluate(() => document.fonts.check('20px Anton'))).toBe(true)
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
  }))
  expect(layout).toEqual({ overflow: false })
  expect(requests.filter(url => /openrouter|inference|images\/generations|symbioteRenderer|symbiote-web\.glb/.test(url))).toEqual([])
  expect(errors).toEqual([])
})

test('traits preview and remain selected; stress toggles reset safely', async ({ page }) => {
  await page.goto('/')
  await enterChapter(page, 'physiology')
  const stealth = page.getByRole('button', { name: /Regeneration & camouflage/ })
  await stealth.click()
  await expect(stealth).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.organism-caption')).toContainText('stealth form')
  await page.getByRole('button', { name: /Organic webbing/ }).click()
  await expect(stealth).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.organism-caption')).toContainText('tensile form')

  await enterChapter(page, 'vulnerabilities')
  const sonic = page.getByRole('button', { name: /Sonic exposure/ })
  const thermal = page.getByRole('button', { name: /Thermal exposure/ })
  await sonic.click()
  await thermal.click()
  await expect(sonic).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stress-status')).toContainText('Critical stress')
  await expect(page.locator('.stress-readout strong')).toHaveText('23%')
  await page.keyboard.press('Escape')
  await expect(sonic).toHaveAttribute('aria-pressed', 'false')
  await expect(thermal).toHaveAttribute('aria-pressed', 'false')
  await sonic.click()
  await enterChapter(page, 'logs')
  await expect(sonic).toHaveAttribute('aria-pressed', 'false')
})

test('reduced motion preserves controls and native cursor', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.bottom-console')).toContainText('Reduced motion')
  await page.mouse.move(180, 210)
  await expect(page.locator('html')).not.toHaveClass(/tendril-cursor-active/)
  await enterChapter(page, 'vulnerabilities')
  await page.getByRole('button', { name: /Sonic exposure/ }).click()
  await expect(page.locator('.shockwave-field')).not.toHaveClass(/visible/)
  await page.getByRole('button', { name: /Thermal exposure/ }).click()
  await expect(page.locator('.stress-status')).toContainText('Critical stress')
})

test('audio is silent by default and explicitly toggleable', async ({ page }) => {
  await page.goto('/')
  const audio = page.getByRole('button', { name: 'Enable ambient audio' })
  await expect(audio).toHaveAttribute('aria-pressed', 'false')
  await audio.click()
  await expect(page.getByRole('button', { name: 'Mute ambient audio' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Mute ambient audio' }).click()
  await expect(audio).toHaveAttribute('aria-pressed', 'false')
})

test('keyboard navigation and touch navigation stay usable', async ({ page, isMobile }) => {
  await page.goto('/')
  if (isMobile) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('navigation', { name: 'Mobile chapters' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Mobile chapters' }).getByRole('link', { name: /Vulnerabilities/ }).click()
    await expect(page.getByRole('navigation', { name: 'Mobile chapters' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: /EVERY BOND/ })).toBeInViewport()
    await page.getByRole('button', { name: /Sonic exposure/ }).scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: /Sonic exposure/ }).click()
    await expect(page.getByRole('button', { name: /Sonic exposure/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('html')).not.toHaveClass(/tendril-cursor-active/)
  } else {
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: 'Skip to experience' })).toBeFocused()
    await page.keyboard.press('Enter')
    await page.mouse.move(500, 300)
    await expect(page.locator('html')).toHaveClass(/tendril-cursor-active/)
  }
})

test('all chapter controls remain usable in poster-only mode', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await enterChapter(page, 'vulnerabilities')
  await page.getByRole('button', { name: /Thermal exposure/ }).click()
  await expect(page.locator('.stress-readout strong')).toHaveText('64%')
  await expect(page.locator('.stress-status')).toContainText('Thermal stimulus active')
  await enterChapter(page, 'logs')
  await expect(page.locator('.dossier')).toHaveCount(3)
  await expect(page.getByRole('button', { name: /Thermal exposure/ })).toHaveAttribute('aria-pressed', 'false')
})
