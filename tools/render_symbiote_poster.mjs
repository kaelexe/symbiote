import { chromium } from '@playwright/test'
import { readdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Run a production preview first: npm run preview -- --host 127.0.0.1 --port 4175
// Capture with the shipping renderer, not an AI service or a second lighting setup.
const base = new URL(process.env.POSTER_PREVIEW_URL ?? 'http://127.0.0.1:4175')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Use a local production preview')
const assets = new URL('../dist/assets/', import.meta.url)
const chunk = (await readdir(assets)).find(name => /^symbioteRenderer-.*\.js$/.test(name))
if (!chunk) throw new Error('Run npm run build first')
const browser = await chromium.launch({ channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 768, height: 768 } })
  await page.goto(base.href)
  await page.locator('h1').waitFor()
  const png = await page.evaluate(async chunk => {
    document.body.style.cssText = 'margin:0;background:transparent'
    const section = document.createElement('section')
    const host = document.createElement('div')
    host.style.cssText = 'width:768px;height:768px'
    section.append(host)
    document.body.replaceChildren(section)
    const { mountSymbiote } = await import(`/assets/${chunk}`)
    return new Promise((resolve, reject) => {
      void mountSymbiote(host, {
        signal: new AbortController().signal, active: () => true,
        onState: state => {
          if (state === 'ready') resolve(host.querySelector('canvas').toDataURL('image/png'))
          if (state === 'poster') reject(new Error('Renderer could not produce a poster'))
        },
      }).catch(reject)
    })
  }, chunk)
  const bytes = await sharp(Buffer.from(png.split(',')[1], 'base64'))
    .webp({ quality: 88, alphaQuality: 90 }).toBuffer()
  if (bytes.byteLength > 60_000) throw new Error(`Poster exceeds 60 KB budget: ${bytes.byteLength}`)
  await writeFile(new URL('../public/models/symbiote-poster.webp', import.meta.url), bytes)
  console.log(`Poster: ${bytes.byteLength} bytes. Run npm run build again to include the updated image.`)
} finally { await browser.close() }
