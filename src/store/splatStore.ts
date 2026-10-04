import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// The currently imported Gaussian splat. The DOM import UI writes the file here;
// SplatScene (inside the canvas) loads it and reports progress / errors back.
// Files are read locally through a blob: URL — nothing is uploaded anywhere.
// ─────────────────────────────────────────────────────────────────────────────

export type SplatFormat = 'ply' | 'splat' | 'ksplat' | 'spz'
export const SPLAT_EXTENSIONS: SplatFormat[] = ['ply', 'splat', 'ksplat', 'spz']

export function splatFormatOf(name: string): SplatFormat | null {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return (SPLAT_EXTENSIONS as string[]).includes(ext) ? (ext as SplatFormat) : null
}

export type SplatStatus = 'idle' | 'loading' | 'ready' | 'error'
export type GizmoMode = 'translate' | 'rotate' | 'off'

export interface SplatFile {
  url: string          // blob: URL for the local file
  name: string
  format: SplatFormat
  size: number         // bytes
}

interface SplatStore {
  file: SplatFile | null
  status: SplatStatus
  progress: number     // 0..100 while reading the file
  error: string | null
  splatCount: number
  radius: number       // rough scene size in metres; scales Fly speed
  focus: [number, number, number] | null   // splat centre in world space (scale bar measures here)

  // Rotate 180° about X (applied live, no reload). Off by default: files are shown
  // as exported; Flip fixes ones that come out upside down (COLMAP-style Y-down).
  flipped: boolean
  // Grid on/off. (The solid floor plane is always hidden while a splat is open:
  // it would hide every splat below y=0.)
  showGrid: boolean
  // Makes splats more solid: 1 = as trained, higher = less see-through.
  opacity: number

  // ── Render quality (see docs/SPLAT_RENDERING.md) ──
  // Largest on-screen radius a splat may have, in pixels. Lower kills the huge
  // "spikes" you get with the camera very close to a splat.
  maxSplatPx: number
  // Anti-aliasing filter. Off = classic 3DGS (most files); on = for files trained
  // with an anti-aliasing filter (Mip-Splatting, gsplat antialiased mode).
  aaTrained: boolean
  // Spark's focalAdjustment: 1 = exact 3DGS projection; 2 = PlayCanvas / SuperSplat
  // look (each splat drawn tighter, so edges and textures read crisper).
  sharpness: number
  // Hide stray splats far outside the object and oversized blobs. Non-destructive.
  removeFloaters: boolean
  floatersHidden: number   // how many the last cleanup hid

  // Move / rotate gizmo on the splat. `transformKey` bumps to reset it.
  gizmoMode: GizmoMode
  gizmoDragging: boolean     // camera mouse-look pauses while a gizmo handle is dragged
  transformKey: number
  frameKey: number           // bumps to fly the camera back to the splat

  openFile: (file: File) => void
  close: () => void
  setProgress: (p: number) => void
  setReady: (splatCount: number, radius: number, focus: [number, number, number]) => void
  setFocus: (p: [number, number, number]) => void
  setError: (msg: string) => void
  clearError: () => void
  toggleFlipped: () => void
  setShowGrid: (v: boolean) => void
  setOpacity: (v: number) => void
  setMaxSplatPx: (v: number) => void
  setAaTrained: (v: boolean) => void
  setSharpness: (v: number) => void
  setRemoveFloaters: (v: boolean) => void
  setFloatersHidden: (n: number) => void
  setGizmoMode: (m: GizmoMode) => void
  setGizmoDragging: (v: boolean) => void
  resetTransform: () => void
  frameSplat: () => void
}

export const useSplatStore = create<SplatStore>((set, get) => ({
  file: null,
  status: 'idle',
  progress: 0,
  error: null,
  splatCount: 0,
  radius: 0,
  focus: null,
  flipped: false,
  showGrid: true,
  opacity: 1,
  maxSplatPx: 512,
  aaTrained: false,
  sharpness: 2,
  removeFloaters: false,
  floatersHidden: 0,
  gizmoMode: 'translate',
  gizmoDragging: false,
  transformKey: 0,
  frameKey: 0,

  openFile: (f) => {
    const format = splatFormatOf(f.name)
    if (!format) {
      set({ error: `Can't open "${f.name}". Use a ${SPLAT_EXTENSIONS.map((e) => '.' + e).join(', ')} file.` })
      return
    }
    const prev = get().file
    if (prev) URL.revokeObjectURL(prev.url)
    set({
      file: { url: URL.createObjectURL(f), name: f.name, format, size: f.size },
      status: 'loading', progress: 0, error: null, splatCount: 0, radius: 0, focus: null, floatersHidden: 0,
    })
  },
  close: () => {
    const prev = get().file
    if (prev) URL.revokeObjectURL(prev.url)
    set({ file: null, status: 'idle', progress: 0, error: null, splatCount: 0, radius: 0, focus: null, gizmoDragging: false })
  },
  setProgress: (p) => set({ progress: p }),
  setReady: (splatCount, radius, focus) => set({ status: 'ready', splatCount, radius, focus, progress: 100, error: null }),
  setFocus: (p) => set({ focus: p }),
  setError: (msg) => set({ status: 'error', error: msg }),
  clearError: () => set({ error: null }),
  toggleFlipped: () => set((s) => ({ flipped: !s.flipped })),
  setShowGrid: (v) => set({ showGrid: v }),
  setOpacity: (v) => set({ opacity: v }),
  setMaxSplatPx: (v) => set({ maxSplatPx: v }),
  setAaTrained: (v) => set({ aaTrained: v }),
  setSharpness: (v) => set({ sharpness: v }),
  setRemoveFloaters: (v) => set({ removeFloaters: v }),
  setFloatersHidden: (n) => set({ floatersHidden: n }),
  setGizmoMode: (m) => set({ gizmoMode: m }),
  setGizmoDragging: (v) => set({ gizmoDragging: v }),
  resetTransform: () => set((s) => ({ transformKey: s.transformKey + 1 })),
  frameSplat: () => set((s) => ({ frameKey: s.frameKey + 1 })),
}))
