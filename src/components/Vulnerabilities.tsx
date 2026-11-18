import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import { AudioLines, Flame, ShieldAlert } from 'lucide-react'

export interface HazardControls { reset: () => void }

// A small DOM-owned island. Clicks, Escape, blur and chapter resets share one
// model, so an automatic reset never causes a React commit or stale toggle.
export default function Vulnerabilities({ reducedMotion, ref }: { reducedMotion: boolean; ref: Ref<HazardControls> }) {
  const section = useRef<HTMLElement>(null)
  const stimuli = useRef({ sonic: false, thermal: false })
  const paint = useCallback(() => {
    const root = section.current
    if (!root) return
    const { sonic, thermal } = stimuli.current
    root.classList.toggle('hazard-active', sonic || thermal)
    for (const name of ['sonic', 'thermal'] as const) {
      const button = root.querySelector(`[data-hazard="${name}"]`)!
      button.setAttribute('aria-pressed', String(stimuli.current[name]))
      button.classList.toggle('engaged', stimuli.current[name])
      button.classList.toggle('thermal', name === 'thermal' && thermal)
    }
    root.querySelector('.shockwave-field')!.classList.toggle('visible', sonic && !reducedMotion)
    root.querySelector('[data-stress-status]')!.textContent = sonic && thermal ? 'Critical stress / multiple stimuli active' : sonic ? 'Sonic stimulus active / cellular instability' : thermal ? 'Thermal stimulus active / cellular stress' : 'Environment stable / awaiting stimulus'
    const integrity = sonic && thermal ? 23 : sonic ? 51 : thermal ? 64 : 98
    root.querySelector('[data-integrity]')!.textContent = String(integrity)
    root.querySelector<HTMLElement>('.integrity-track > span')!.style.transform = `scaleX(${integrity / 100})`
    root.querySelector('[data-integrity-status]')!.textContent = sonic || thermal ? 'WARNING / UNSTABLE BIOMASS' : 'PASSIVE OBSERVATION'
  }, [reducedMotion])
  const reset = useCallback(() => {
    if (!stimuli.current.sonic && !stimuli.current.thermal) return
    stimuli.current.sonic = false
    stimuli.current.thermal = false
    paint()
  }, [paint])
  useImperativeHandle(ref, () => ({ reset }), [reset])
  useEffect(() => {
    paint()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') reset() }
    window.addEventListener('blur', reset)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('blur', reset)
      window.removeEventListener('keydown', escape)
    }
  }, [paint, reset])
  const toggle = (name: 'sonic' | 'thermal') => {
    stimuli.current[name] = !stimuli.current[name]
    paint()
  }
  return (
    <section ref={section} id="vulnerabilities" className="chapter vulnerabilities" aria-labelledby="vulnerabilities-title">
      <div className="section-content left-content">
        <div className="chapter-kicker"><span>03 / VULNERABILITIES</span><span className="small-rule" /></div>
        <h2 id="vulnerabilities-title">EVERY BOND<br />HAS A BREAKING<br /><span className="outline-type">POINT.</span></h2>
        <p className="section-intro">Even the perfect predator has limits.<br />Explore the effects on containment integrity.</p>
        <div className="hazard-controls">
          <button className="hazard-button" data-hazard="sonic" aria-pressed="false" onClick={() => toggle('sonic')}>
            <AudioLines size={24} strokeWidth={1.4} />
            <span><strong>Sonic exposure</strong><small>4–6 kHz / resonance test</small></span>
            <span className="hazard-switch"><span /></span>
          </button>
          <button className="hazard-button" data-hazard="thermal" aria-pressed="false" onClick={() => toggle('thermal')}>
            <Flame size={24} strokeWidth={1.4} />
            <span><strong>Thermal exposure</strong><small>Extreme heat / cellular stress</small></span>
            <span className="hazard-switch"><span /></span>
          </button>
        </div>
        <div className="stress-status" role="status" aria-live="polite"><ShieldAlert size={15} /><span data-stress-status>Environment stable / awaiting stimulus</span></div>
        <p className="interaction-note">Illustrative readouts only. No high-frequency audio.<br />Press Escape to end all tests.</p>
      </div>
      <div className="shockwave-field" aria-hidden="true"><span /><span /><span /></div>
      <div className="stress-readout"><span>CONTAINMENT INTEGRITY</span><strong><span data-integrity>98</span><small>%</small></strong><div className="integrity-track"><span style={{ transform: 'scaleX(0.98)' }} /></div><span data-integrity-status>PASSIVE OBSERVATION</span></div>
    </section>
  )
}
