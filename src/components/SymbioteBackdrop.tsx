import { useEffect, useRef, useState } from 'react'
import { allowWebGL } from '../graphicsBudget'
import type { Viewer } from './symbioteRenderer'

interface Connection extends EventTarget { saveData?: boolean; effectiveType?: string }

export default function SymbioteBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const [eligible, setEligible] = useState(false)
  useEffect(() => {
    const media = matchMedia('(min-width: 1000px) and (hover: hover) and (pointer: fine)')
    const device = navigator as Navigator & { deviceMemory?: number; connection?: Connection }
    const update = () => setEligible(allowWebGL({
      desktopPointer: media.matches, reducedMotion,
      saveData: device.connection?.saveData, effectiveType: device.connection?.effectiveType,
      cores: device.hardwareConcurrency, memory: device.deviceMemory,
    }))
    update()
    media.addEventListener('change', update)
    device.connection?.addEventListener('change', update)
    return () => {
      media.removeEventListener('change', update)
      device.connection?.removeEventListener('change', update)
    }
  }, [reducedMotion])

  useEffect(() => {
    const element = host.current
    if (!element || !eligible) return
    const controller = new AbortController()
    let viewer: Viewer | undefined
    let visible = false, started = false, disposed = false
    let idle: number | undefined, timer: number | undefined
    const active = () => visible && !document.hidden && !disposed
    const start = async () => {
      idle = undefined; timer = undefined
      if (started || !active()) return
      started = true
      element.dataset.state = 'loading'
      try {
        const { mountSymbiote } = await import('./symbioteRenderer')
        if (controller.signal.aborted) return
        viewer = await mountSymbiote(element, {
          signal: controller.signal, active,
          onState: state => { if (!disposed) element.dataset.state = state },
        })
        if (disposed) viewer.dispose()
        else viewer.setRunning(active())
      } catch {
        // Context denial, asset/decode errors, and cancellation never break the HTML site.
        if (!disposed) element.dataset.state = 'poster'
      }
    }
    const update = () => {
      viewer?.setRunning(active())
      if (started || !active() || idle !== undefined || timer !== undefined) return
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(() => { void start() }, { timeout: 1500 })
      else timer = window.setTimeout(() => { void start() }, 200)
    }
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      update()
    }, { threshold: 0.08 })
    intersection.observe(element)
    document.addEventListener('visibilitychange', update)
    return () => {
      disposed = true
      controller.abort()
      if (idle !== undefined) window.cancelIdleCallback(idle)
      if (timer !== undefined) window.clearTimeout(timer)
      intersection.disconnect()
      document.removeEventListener('visibilitychange', update)
      viewer?.dispose()
      element.dataset.state = 'poster'
    }
  }, [eligible])

  return (
    <div ref={host} className="specimen-visual" data-state="poster" aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}models/symbiote-poster.webp`} alt="" width="768" height="768" decoding="async" fetchPriority="low" />
    </div>
  )
}
