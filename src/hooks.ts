import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { scrollChapter } from './experience'

gsap.registerPlugin(ScrollTrigger)
// Lenis uses this ticker, not its own RAF. Keep scroll time continuous after stalls.
gsap.ticker.lagSmoothing(0)

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export function useExperienceScroll(
  reduced: boolean,
  progress: RefObject<HTMLDivElement | null>,
  onChapterChange: () => void,
) {
  const initialAnchorHandled = useRef(false)
  useEffect(() => {
    // With client-side rendering the browser can look for the fragment before
    // React has mounted it. Resolve it once, before Lenis measures initial scroll.
    if (!initialAnchorHandled.current) {
      initialAnchorHandled.current = true
      try {
        const id = decodeURIComponent(location.hash.slice(1))
        if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
      } catch { /* An invalid URL fragment must not interrupt the experience. */ }
    }
    const lenis = reduced ? null : new Lenis({ duration: 1.15, smoothWheel: true, anchors: true })
    const tick = (time: number) => lenis?.raf(time * 1000)
    lenis?.on('scroll', ScrollTrigger.update)
    if (lenis) gsap.ticker.add(tick)
    const typography = gsap.context(() => {
      if (!reduced) gsap.to('.hero-copy h1', {
        yPercent: -12,
        skewY: -2,
        ease: 'none',
        scrollTrigger: { trigger: '#origin', start: 'top top', end: 'bottom top', scrub: 0.8 },
      })
    })
    let previousChapter = -1
    // These readouts are DOM-owned: scroll never schedules a React render.
    const links = [...document.querySelectorAll<HTMLElement>('[data-chapter]')]
    const page = document.querySelector('[data-chapter-page]')
    let bounds: { top: number; height: number }[] = []
    const measure = () => {
      bounds = [...document.querySelectorAll<HTMLElement>('main > section')].map(section => ({ top: section.offsetTop, height: section.offsetHeight }))
    }
    measure()
    const update = (fraction: number) => {
        const scroll = window.scrollY
        if (progress.current) progress.current.style.transform = `scaleX(${fraction})`
        const nextChapter = scrollChapter(bounds, scroll, innerHeight)
        if (nextChapter !== previousChapter) {
          previousChapter = nextChapter
          links.forEach(link => {
            if (Number(link.dataset.chapter) === nextChapter) link.setAttribute('aria-current', 'location')
            else link.removeAttribute('aria-current')
          })
          if (page) page.textContent = `0${nextChapter + 1}`
          onChapterChange()
        }
    }
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onRefresh: self => { measure(); update(self.progress) },
      onUpdate: self => update(self.progress),
    })
    ScrollTrigger.refresh()
    return () => {
      trigger.kill()
      typography.revert()
      gsap.ticker.remove(tick)
      lenis?.destroy()
    }
  }, [reduced, progress, onChapterChange])
}

interface AudioEngine {
  context: AudioContext
  oscillators: OscillatorNode[]
}

// No autoplay and no microphone: this is a locally synthesized, opt-in low drone.
export function useAmbientAudio() {
  const engine = useRef<AudioEngine | null>(null)
  const generation = useRef(0)
  const [enabled, setEnabled] = useState(false)
  const [audioError, setAudioError] = useState(false)
  const dispose = useCallback(() => {
    generation.current++
    const current = engine.current
    engine.current = null
    current?.oscillators.forEach(osc => { try { osc.stop() } catch { /* Already stopped. */ } })
    void current?.context.close()
  }, [])
  const stop = useCallback(() => { dispose(); setEnabled(false) }, [dispose])
  const toggle = async () => {
    if (engine.current) { stop(); return }
    const ticket = ++generation.current
    try {
      const context = new AudioContext()
      const gain = context.createGain()
      gain.gain.value = 0.035
      const oscillators = [47, 50.5, 94].map((frequency, i) => {
        const oscillator = context.createOscillator()
        oscillator.type = i === 2 ? 'sine' : 'triangle'
        oscillator.frequency.value = frequency
        oscillator.connect(gain)
        oscillator.start()
        return oscillator
      })
      gain.connect(context.destination)
      const current = { context, oscillators }
      engine.current = current
      await context.resume()
      if (ticket !== generation.current) return
      setAudioError(false)
      setEnabled(true)
    } catch {
      stop()
      setAudioError(true)
    }
  }
  useEffect(() => {
    const suspend = () => { if (document.hidden) stop() }
    document.addEventListener('visibilitychange', suspend)
    return () => {
      document.removeEventListener('visibilitychange', suspend)
      dispose()
    }
  }, [dispose, stop])
  return { enabled, toggle, audioError }
}
