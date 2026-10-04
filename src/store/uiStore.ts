import { create } from 'zustand'

export type CameraMode = 'fly' | 'walk'
export type Quality = 'low' | 'high'

// Axis glow rides with quality: 0.5 in Low, a whisper (0.12) in High where
// post-processing already lifts fine lines.
const axisGlowFor = (q: Quality) => (q === 'low' ? 0.5 : 0.12)

// The original grid look. "Reset to defaults" restores these.
const DISPLAY_DEFAULTS = {
  sceneIllumination: 3,   // full brightness
  gridIntensity: 2,
  gridLineWidth: 0.6,     // fine hairline; lower = thinner
}

interface UIStore {
  // Camera
  cameraMode: CameraMode
  setCameraMode: (mode: CameraMode) => void

  // Render quality — 'low' disables shadows + post-processing for weak/integrated GPUs
  quality: Quality
  setQuality: (q: Quality) => void
  toggleQuality: () => void

  // Display sliders
  sceneIllumination: number   // 0..3 multiplier on scene lights + backdrop brightness
  setSceneIllumination: (v: number) => void
  gridIntensity: number       // 0..1 fades the lines, 1..2 brightens them
  setGridIntensity: (v: number) => void
  gridLineWidth: number       // on-screen line half-width in device pixels
  setGridLineWidth: (v: number) => void
  axisGlow: number            // origin-axis glow strength
  setAxisGlow: (v: number) => void
  resetDisplay: () => void    // sliders back to defaults (axis glow per current quality)
}

export const useUIStore = create<UIStore>((set) => ({
  cameraMode: 'fly',
  setCameraMode: (mode) => set({ cameraMode: mode }),

  quality: 'low',   // default to Low — safe for integrated graphics
  setQuality: (q) => set({ quality: q, axisGlow: axisGlowFor(q) }),
  toggleQuality: () =>
    set((s) => {
      const q: Quality = s.quality === 'low' ? 'high' : 'low'
      return { quality: q, axisGlow: axisGlowFor(q) }
    }),

  ...DISPLAY_DEFAULTS,
  setSceneIllumination: (v) => set({ sceneIllumination: v }),
  setGridIntensity: (v) => set({ gridIntensity: v }),
  setGridLineWidth: (v) => set({ gridLineWidth: v }),
  axisGlow: axisGlowFor('low'),
  setAxisGlow: (v) => set({ axisGlow: v }),
  resetDisplay: () => set((s) => ({ ...DISPLAY_DEFAULTS, axisGlow: axisGlowFor(s.quality) })),
}))
