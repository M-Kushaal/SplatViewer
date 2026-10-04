import { create } from 'zustand'

// Bridges live camera info from inside the R3F canvas out to DOM overlays
// (e.g. the scale bar). Updated each frame by ScaleTracker, but only when it
// changes meaningfully, so DOM overlays don't re-render every frame.
interface ViewStore {
  metersPerPixel: number
  setMetersPerPixel: (v: number) => void

  // Camera orientation (quaternion xyzw) for the DOM axis gizmo.
  quat: [number, number, number, number]
  setQuat: (q: [number, number, number, number]) => void

  // Live camera readout for the HUD (position + euler angles in degrees).
  camPos: [number, number, number]
  camAngles: [number, number, number]           // [pitch, yaw, roll] degrees
  setCamReadout: (pos: [number, number, number], angles: [number, number, number]) => void

  // Manual pose to apply (set by the HUD / Home button; consumed in-canvas).
  pending: { pos: [number, number, number]; angles: [number, number, number] } | null
  applyPose: (pos: [number, number, number], angles: [number, number, number]) => void
  clearPending: () => void
}

export const useViewStore = create<ViewStore>((set) => ({
  metersPerPixel: 0.1,
  setMetersPerPixel: (v) => set({ metersPerPixel: v }),

  quat: [0, 0, 0, 1],
  setQuat: (q) => set({ quat: q }),

  camPos: [0, 0, 0],
  camAngles: [0, 0, 0],
  setCamReadout: (pos, angles) => set({ camPos: pos, camAngles: angles }),

  pending: null,
  applyPose: (pos, angles) => set({ pending: { pos, angles } }),
  clearPending: () => set({ pending: null }),
}))
