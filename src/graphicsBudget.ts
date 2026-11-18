export interface DeviceBudget {
  desktopPointer: boolean
  reducedMotion: boolean
  saveData?: boolean
  effectiveType?: string
  cores?: number
  memory?: number
}

export function allowWebGL(device: DeviceBudget) {
  return device.desktopPointer && !device.reducedMotion && !device.saveData
    && !['slow-2g', '2g', '3g'].includes(device.effectiveType ?? '')
    && (!device.cores || device.cores >= 4)
    && (!device.memory || device.memory >= 4)
}

export function renderSize(width: number, height: number, dpr: number, economy = false) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const scale = Math.min(economy ? 0.85 : 1.25, Math.max(0.5, dpr), Math.sqrt((economy ? 250_000 : 650_000) / (w * h)))
  return { width: Math.max(1, Math.floor(w * scale)), height: Math.max(1, Math.floor(h * scale)) }
}
