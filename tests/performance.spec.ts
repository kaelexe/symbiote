import { expect, test } from '@playwright/test'

test('scroll, pointer physics, restraint and automatic hazard resets make zero React commits', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Fine-pointer physics audit; mobile controls covered separately.')
  await page.addInitScript(() => {
    const audit = { commits: 0 }
    // Implement the DevTools hook, including the renderer map used by Vite Refresh.
    // This measures actual commits, not a source-text approximation.
    const hook = {
      supportsFiber: true,
      renderers: new Map<number, unknown>(),
      inject(renderer: unknown) { this.renderers.set(1, renderer); return 1 },
      onCommitFiberRoot() { audit.commits++ },
      onCommitFiberUnmount() {},
      onScheduleFiberRoot() {},
    }
    Object.assign(window, { performanceAudit: audit, __REACT_DEVTOOLS_GLOBAL_HOOK__: hook })
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 })
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 8 })
  })
  const count = () => page.evaluate(() => (window as unknown as { performanceAudit: { commits: number } }).performanceAudit.commits)
  await page.goto('/')
  await expect(page.locator('.specimen-visual')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('.desktop-nav a').first()).toHaveAttribute('aria-current', 'location')
  expect(await count()).toBeGreaterThan(0)
  const before = await count()
  await page.evaluate(async () => {
    const start = performance.now()
    let i = 0
    while (performance.now() - start < 1300) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      window.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: ++i % 2 ? 250 : 1200, clientY: 400 }))
    }
  })
  await expect(page.locator('[data-tendril-cursor]')).toHaveAttribute('data-mode', 'restrained')
  await page.evaluate(() => window.scrollTo(0, document.getElementById('vulnerabilities')!.offsetTop))
  await expect(page.locator('[data-chapter-page]')).toHaveText('03')
  expect(await count()).toBe(before)
  const sonic = page.getByRole('button', { name: /Sonic exposure/ })
  await sonic.click()
  await expect(sonic).toHaveAttribute('aria-pressed', 'true')
  const active = await count()
  await page.evaluate(() => window.scrollTo(0, document.getElementById('logs')!.offsetTop))
  await expect(page.locator('[data-chapter-page]')).toHaveText('04')
  await expect(sonic).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-tendril-cursor]')).toHaveAttribute('data-mode', 'free')
  expect(await count()).toBe(active)
  // A genuine discrete React UI change must still be observable by this probe.
  await page.evaluate(() => window.scrollTo(0, document.getElementById('physiology')!.offsetTop))
  await page.getByRole('button', { name: /Organic webbing/ }).click()
  expect(await count()).toBeGreaterThan(active)
  await expect(page.locator('[data-chapter-page]')).toHaveText('02')
  await expect(page.locator('.desktop-nav a[data-chapter="1"]')).toHaveAttribute('aria-current', 'location')
  // Reset and React parent renders must not desynchronize the next stimulus toggle.
  await sonic.click()
  await expect(sonic).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(sonic).toHaveAttribute('aria-pressed', 'false')
})
