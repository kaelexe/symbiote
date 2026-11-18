import {
  Box3, DataTexture, DirectionalLight, EquirectangularReflectionMapping,
  Group, HemisphereLight, Mesh, PerspectiveCamera, Scene, SRGBColorSpace,
  Texture, Vector3, WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { renderSize } from '../graphicsBudget'

export interface Viewer {
  setRunning: (running: boolean) => void
  dispose: () => void
}
interface Options {
  signal: AbortSignal
  active: () => boolean
  onState: (state: 'ready' | 'paused' | 'poster') => void
}

// Tiny procedural reflection map: no external HDR, lights, textures, or PMREM scene.
function reflectionMap() {
  const width = 256, height = 128
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const panel = (x > 22 && x < 42 && y > 22 && y < 98)
        || (x > 132 && x < 176 && y > 12 && y < 45)
        || (x > 205 && x < 214 && y > 30 && y < 109)
      const value = panel ? 245 : 28 + Math.round((1 - y / height) * 25)
      const i = (y * width + x) * 4
      data[i] = value; data[i + 1] = value; data[i + 2] = Math.min(255, value + 9); data[i + 3] = 255
    }
  }
  const texture = new DataTexture(data, width, height)
  texture.colorSpace = SRGBColorSpace
  texture.mapping = EquirectangularReflectionMapping
  texture.needsUpdate = true
  return texture
}

function disposeModel(model: Group) {
  const geometries = new Set<Mesh['geometry']>()
  const materials = new Set<Exclude<Mesh['material'], unknown[]>>()
  const textures = new Set<Texture>()
  model.traverse(object => {
    if (!(object instanceof Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
      Object.values(material).forEach(value => { if (value instanceof Texture) textures.add(value) })
    }
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
  textures.forEach(texture => texture.dispose())
}

export async function mountSymbiote(host: HTMLElement, options: Options): Promise<Viewer> {
  const response = await fetch(`${import.meta.env.BASE_URL}models/symbiote-web.glb`, { signal: options.signal })
  if (!response.ok) throw new Error('Specimen unavailable')
  const buffer = await response.arrayBuffer()
  if (options.signal.aborted) throw new DOMException('Aborted', 'AbortError')
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '')
  const model = gltf.scene
  if (options.signal.aborted) { disposeModel(model); throw new DOMException('Aborted', 'AbortError') }
  let renderer: WebGLRenderer
  try {
    // Depth is needed for the interlocking tendrils. No stencil or post-processing.
    renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', depth: true, stencil: false })
  } catch (error) { disposeModel(model); throw error }
  const canvas = renderer.domElement
  canvas.dataset.symbioteCanvas = ''
  canvas.dataset.fps = '30'
  canvas.setAttribute('aria-hidden', 'true')
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x030303, 0)
  const scene = new Scene()
  const camera = new PerspectiveCamera(42, 1, 0.1, 30)
  camera.position.set(0, 0, 7)
  const environment = reflectionMap()
  scene.environment = environment
  scene.environmentIntensity = 2.4
  scene.add(new HemisphereLight(0xc6d3ff, 0x120303, 1.1))
  const key = new DirectionalLight(0xe8edff, 4)
  key.position.set(-3, 4, 5)
  const rim = new DirectionalLight(0x8a0303, 6)
  rim.position.set(4, 1, -2)
  scene.add(key, rim)
  const bounds = new Box3().setFromObject(model)
  const size = bounds.getSize(new Vector3())
  model.position.sub(bounds.getCenter(new Vector3()))
  const pivot = new Group()
  pivot.scale.setScalar(4.9 / Math.max(size.x, size.y, size.z))
  pivot.add(model)
  scene.add(pivot)
  host.append(canvas)

  let disposed = false, running = false, economy = false
  let frame = 0, lastRender = 0, lastTick = 0, clock = 0, samples = 0, slowFrames = 0
  let heroHeight = 1, heroTop = 0
  const pointer = { x: 0, y: 0 }
  const resize = () => {
    const rect = host.getBoundingClientRect()
    const target = renderSize(rect.width, rect.height, devicePixelRatio, economy)
    renderer.setSize(target.width, target.height, false)
    camera.aspect = rect.width / Math.max(1, rect.height)
    camera.updateProjectionMatrix()
    const hero = host.closest<HTMLElement>('section')!
    heroHeight = hero.offsetHeight
    heroTop = hero.offsetTop
  }
  const move = (event: PointerEvent) => {
    if (!running || event.pointerType === 'touch') return
    pointer.x = event.clientX / innerWidth * 2 - 1
    pointer.y = event.clientY / innerHeight * 2 - 1
  }
  const leave = () => { pointer.x = 0; pointer.y = 0 }
  const observer = new ResizeObserver(resize)
  const dispose = () => {
    if (disposed) return
    disposed = true
    running = false
    cancelAnimationFrame(frame)
    observer.disconnect()
    window.removeEventListener('pointermove', move)
    document.removeEventListener('pointerleave', leave)
    canvas.removeEventListener('webglcontextlost', lost)
    disposeModel(model)
    environment.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }
  const fail = () => { dispose(); options.onState('poster') }
  const lost = (event: Event) => { event.preventDefault(); fail() }
  const tick = (now: number) => {
    if (!running || disposed) return
    // Check visibility again here, before drawing, not just in asynchronous observers.
    if (!options.active() || document.hidden) { setRunning(false); return }
    frame = requestAnimationFrame(tick)
    const frameGap = lastTick ? now - lastTick : 0
    lastTick = now
    const interval = 1000 / (economy ? 24 : 30)
    // Never render early: an epsilon here can leave the modulo clock unchanged,
    // allowing two successive draws and exceeding the nominal frame-rate budget.
    if (now - lastRender < interval) return
    const dt = Math.min((now - lastRender) / 1000, 0.06)
    lastRender = now - ((now - lastRender) % interval)
    clock += dt
    const scroll = Math.min(1, Math.max(0, (scrollY - heroTop) / heroHeight))
    const ease = 1 - Math.exp(-dt * 4)
    pivot.rotation.x += (pointer.y * 0.06 + Math.sin(clock * 0.25) * 0.025 - pivot.rotation.x) * ease
    pivot.rotation.y += (pointer.x * 0.12 + scroll * 0.2 - pivot.rotation.y) * ease
    pivot.rotation.z = Math.sin(clock * 0.3) * 0.015 + scroll * 0.08
    const breath = 4.9 / Math.max(size.x, size.y, size.z) * (1 + Math.sin(clock * 1.4) * 0.008)
    pivot.scale.setScalar(breath)
    const before = performance.now()
    try { renderer.render(scene, camera) } catch { fail(); return }
    const renderTime = performance.now() - before
    samples++
    if (samples === 2) {
      canvas.dataset.triangles = String(renderer.info.render.triangles)
      canvas.dataset.drawCalls = String(renderer.info.render.calls)
      options.onState('ready')
    }
    // Ignore initial shader compilation. Downshift first, then permanently use the poster
    // if sustained frame cost is still too high. No retry loop on struggling devices.
    if (samples > 12) {
      slowFrames = renderTime > 24 || frameGap > 75 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
      if (slowFrames >= 18) {
        if (economy) { fail(); return }
        economy = true
        canvas.dataset.fps = '24'
        resize()
        slowFrames = 0
      }
    }
  }
  const setRunning = (value: boolean) => {
    if (disposed || running === value) return
    running = value
    cancelAnimationFrame(frame)
    lastRender = performance.now()
    lastTick = 0
    if (running) {
      if (samples >= 2) options.onState('ready')
      frame = requestAnimationFrame(tick)
    } else if (samples >= 2) options.onState('paused')
  }
  canvas.addEventListener('webglcontextlost', lost)
  window.addEventListener('pointermove', move, { passive: true })
  document.addEventListener('pointerleave', leave)
  observer.observe(host)
  resize()
  setRunning(options.active())
  return { setRunning, dispose }
}
