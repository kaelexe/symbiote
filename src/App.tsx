import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowDownRight, ArrowUpRight, Crosshair, Menu, MoveUpRight, Plus, ShieldAlert, Volume2, VolumeX, X } from 'lucide-react'
import TendrilCursor from './components/TendrilCursor'
import SymbioteBackdrop from './components/SymbioteBackdrop'
import Vulnerabilities from './components/Vulnerabilities'
import type { HazardControls } from './components/Vulnerabilities'
import type { Trait } from './experience'
import { useAmbientAudio, useExperienceScroll, useReducedMotion } from './hooks'
import './App.css'

const chapters = [
  { id: 'origin', title: 'Origin & lore', short: 'Origin' },
  { id: 'physiology', title: 'Capabilities & physiology', short: 'Physiology' },
  { id: 'vulnerabilities', title: 'Vulnerabilities', short: 'Stress test' },
  { id: 'logs', title: 'Containment logs', short: 'Archives' },
]

const traits: { id: Trait; number: string; title: string; text: string; reading: string }[] = [
  { id: 'weaponry', number: 'A', title: 'Shapeshifting & weaponry', text: 'No fixed form. The organism restructures its biomass into blades, shields, and whatever survival demands.', reading: 'Biomass hardened / offensive form' },
  { id: 'webbing', number: 'B', title: 'Organic webbing & tendrils', text: 'Living extensions of the same body. Every filament can anchor, sense, and pull with superhuman force.', reading: 'Filament extension / tensile form' },
  { id: 'stealth', number: 'C', title: 'Regeneration & camouflage', text: 'Adaptive cells repair damaged tissue and mimic surrounding surfaces. The perfect organism knows when to disappear.', reading: 'Cellular adaptation / stealth form' },
]

function App() {
  const reducedMotion = useReducedMotion()
  const progress = useRef<HTMLDivElement>(null)
  const audio = useAmbientAudio()
  const [menuOpen, setMenuOpen] = useState(false)
  const [trait, setTrait] = useState<Trait>('weaponry')
  const [preview, setPreview] = useState<Trait | null>(null)
  const hazards = useRef<HazardControls>(null)
  const resetHazards = useCallback(() => { hazards.current?.reset() }, [])
  useExperienceScroll(reducedMotion, progress, resetHazards)
  const activeTrait = preview ?? trait

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('keydown', escape)
    }
  }, [])

  return (
    <>
      <a className="skip-link" href="#main">Skip to experience</a>
      <TendrilCursor reducedMotion={reducedMotion} />
      <div className="screen-grain" aria-hidden="true" />

      <header className="site-header">
        <a href="#origin" className="brand" aria-label="Symbiote project, back to origin">
          <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M20 6v28M15 12 6 5l5 12 7 4-8 2-5 12 12-8m8-15 9-7-5 12-7 4 8 2 5 12-12-8" stroke="currentColor" strokeWidth="2.5" />
            <path d="m14 15 6 5 6-5-2 13-4 6-4-6z" fill="currentColor" />
          </svg>
          <span>SYMBIOTE<span className="brand-sub">RESEARCH DIVISION</span></span>
        </a>
        <nav aria-label="Chapters" className="desktop-nav">
          {chapters.map((item, index) => (
            <a key={item.id} href={`#${item.id}`} data-chapter={index}>
              <span>0{index + 1}</span> {item.short}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <span className="classified"><span className="status-dot" />Containment archive</span>
          <button className="icon-button mobile-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <nav className="mobile-nav" id="mobile-navigation" aria-label="Mobile chapters">
          {chapters.map((item, index) => <a key={item.id} href={`#${item.id}`} onClick={() => setMenuOpen(false)}>0{index + 1} / {item.title}<ArrowUpRight size={18} /></a>)}
        </nav>
      )}

      <aside className="chapter-rail" aria-label="Chapter position">
        <span className="rail-label">THE KLYNTAR PROJECT</span>
        <div className="rail-ticks">
          {chapters.map((item, index) => <a href={`#${item.id}`} key={item.id} data-chapter={index} aria-label={item.title}><span />0{index + 1}</a>)}
        </div>
        <span className="rail-coordinate">40°42′51″ N</span>
      </aside>

      <main id="main">
        <section id="origin" className="chapter hero" aria-labelledby="origin-title">
          <SymbioteBackdrop reducedMotion={reducedMotion} />
          <div className="hero-topline"><span><span className="red-square" />Restricted access / File 001</span><span>EXTRATERRESTRIAL LIFEFORM</span></div>
          <div className="hero-copy">
            <div className="chapter-kicker"><span>01 / ORIGIN & LORE</span><span className="small-rule" /></div>
            <h1 id="origin-title"><span className="hero-pretitle">WE ARE</span><span className="hero-title">VENOM<span className="title-period">.</span></span></h1>
            <p className="hero-description">Not a parasite.<br />A bond beyond human.</p>
            <p className="hero-support">One organism. Two minds. An instinct to survive.<br />Enter the world of the Klyntar symbiote.</p>
            <a className="primary-button" href="#physiology">Explore the organism<ArrowDownRight size={19} /></a>
          </div>
          <div className="hero-bottom">
            <a href="#physiology" className="scroll-cue"><span className="scroll-icon"><ArrowDown size={14} /></span>Scroll to investigate</a>
            <div className="specimen-readout"><span className="red-text">KNOWN HOST</span><strong>EDDIE BROCK</strong><span>Bond status <i /> Symbiotic</span></div>
            <div className="hero-facts"><div><span>SPECIES</span><strong>Klyntar</strong></div><div><span>ORIGIN</span><strong>Extraterrestrial</strong></div><div><span>THREAT LEVEL</span><strong className="red-text">Unclassified</strong></div></div>
          </div>
          <span className="hero-watermark" aria-hidden="true">LIFE FINDS A HOST.</span>
        </section>

        <section id="physiology" className="chapter physiology" aria-labelledby="physiology-title">
          <div className="section-watermark" aria-hidden="true">ADAPT.</div>
          <div className="section-content left-content">
            <div className="chapter-kicker"><span>02 / CAPABILITIES & PHYSIOLOGY</span><span className="small-rule" /></div>
            <h2 id="physiology-title">NO BONES.<br />NO BOUNDARIES.</h2>
             <p className="section-intro">An organism without a single shape.<br />A weapon without a single weakness. Almost.</p>
            <div className="organism-caption"><span className="caption-line" /><Crosshair size={15} /><span>Adaptation profile<br /><b>{traits.find(t => t.id === activeTrait)?.reading}</b></span></div>
          </div>
          <div className="adaptation-panel">
            <div className="trait-list" aria-label="Select a symbiote adaptation">
              {traits.map(item => (
                <button key={item.id} className={`trait-button ${activeTrait === item.id ? 'is-active' : ''}`} aria-pressed={trait === item.id} onClick={() => setTrait(item.id)} onPointerEnter={event => { if (event.pointerType !== 'touch') setPreview(item.id) }} onPointerLeave={() => setPreview(null)} onFocus={() => setPreview(item.id)} onBlur={() => setPreview(null)}>
                  <span className="trait-number">{item.number}</span>
                  <span className="trait-body"><strong>{item.title}</strong><span>{item.text}</span></span>
                  <Plus className="trait-plus" size={18} />
                </button>
              ))}
            </div>
            <p className="interaction-note"><MoveUpRight size={12} />Hover to study. Select to hold an adaptation.</p>
          </div>
        </section>

        <Vulnerabilities ref={hazards} reducedMotion={reducedMotion} />

        <section id="logs" className="chapter logs" aria-labelledby="logs-title">
          <div className="logs-heading"><div><div className="chapter-kicker"><span>04 / CONTAINMENT LOGS</span><span className="small-rule" /></div><h2 id="logs-title">THE ORGANISM<br />REMEMBERS.</h2></div><p>Fragments from the archive.<br />Some things survive the host.</p></div>
          <div className="dossier-grid">
            <article className="dossier"><div className="dossier-top"><span>RECORD / 001</span><Crosshair size={18} /></div><span className="dossier-category">Biological anomaly</span><h3>Genetic<br />memory.</h3><p>A symbiote retains traces of its previous hosts. Abilities, instincts, and memories can outlive the original bond.</p><div className="dossier-bottom"><span>STATUS: INHERITED</span><span className="barcode" aria-hidden="true" /></div></article>
            <article className="dossier"><div className="dossier-top"><span>RECORD / 002</span><span className="hive-symbol" aria-hidden="true">⌘</span></div><span className="dossier-category">Collective consciousness</span><h3>Never<br />truly alone.</h3><p>The symbiote hive mind connects the species across the cosmos. At its ancient center: Knull, the King in Black.</p><div className="dossier-bottom"><span>STATUS: CONNECTED</span><span className="barcode" aria-hidden="true" /></div></article>
            <article className="dossier"><div className="dossier-top"><span>RECORD / 003</span><ShieldAlert size={19} /></div><span className="dossier-category">Known countermeasure</span><h3>The<br />anti-venom.</h3><p>Not every cure is harmless. Anti-Venom's cleansing properties can neutralize symbiote matter and sever the bond.</p><div className="dossier-bottom"><span className="red-text">STATUS: CRITICAL</span><span className="barcode" aria-hidden="true" /></div></article>
          </div>
          <div className="lore-note"><span className="red-square" /><p>Inspired by Marvel's Venom. An independent, non-commercial fan website.<br />Character and lore belong to their respective owners. Continuity varies across stories.</p><a href="#origin">Return to origin<ArrowUpRight size={16} /></a></div>
          <footer><a className="footer-wordmark" href="#origin">WE ARE VENOM.</a><span>END OF FILE / NOT THE END OF THE ORGANISM</span><ArrowUpRight size={24} /></footer>
        </section>
      </main>

      <div className="bottom-console">
        <span><span className="status-dot" />{reducedMotion ? 'Reduced motion / observation mode' : 'Containment protocol active'}</span>
        <div className="console-right"><span className="audio-message" role="status">{audio.audioError ? 'Audio unavailable' : audio.enabled ? 'Ambient transmission active' : 'Sound off'}</span><button className="sound-button" onClick={() => void audio.toggle()} aria-label={audio.enabled ? 'Mute ambient audio' : 'Enable ambient audio'} aria-pressed={audio.enabled}>{audio.enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}<span>AUDIO {audio.enabled ? 'ON' : 'OFF'}</span></button><span className="console-page"><b data-chapter-page>01</b> <span>/ 04</span></span></div>
      </div>
      <div className="page-progress" aria-hidden="true"><div ref={progress} /></div>
      <span className="sr-only" aria-live="polite">{reducedMotion ? 'Reduced motion is active. All controls remain available without violent animation.' : ''}</span>
      <span className="corner-cross corner-cross-left" aria-hidden="true">+</span><span className="corner-cross corner-cross-right" aria-hidden="true">+</span>
    </>
  )
}

export default App
