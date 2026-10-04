import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSplatStore, SPLAT_EXTENSIONS } from '../../store/splatStore'
import type { GizmoMode } from '../../store/splatStore'
import { useUIStore } from '../../store/uiStore'

const ACCEPT = SPLAT_EXTENSIONS.map((e) => '.' + e).join(',')

const GIZMO_MODES: { mode: GizmoMode; label: string; tip: string }[] = [
  { mode: 'translate', label: 'Move',   tip: 'Drag the coloured arrows to move the splat' },
  { mode: 'rotate',    label: 'Rotate', tip: 'Drag the coloured rings to rotate the splat' },
  { mode: 'off',       label: 'Off',    tip: 'Hide the gizmo' },
]

// Everything splat-related, in one panel on the left under the camera box:
// open a file (or drop one anywhere on the page), load progress, the move /
// rotate gizmo, Flip / Floor toggles and close.
export function SplatPanel() {
  const s = useSplatStore()
  const cameraMode = useUIStore((u) => u.cameraMode)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragging = useFileDrop(s.openFile)

  return (
    <>
      <div className="absolute top-[124px] left-3 z-10 panel rounded-lg p-2 w-[188px] text-[11px] text-white/60">
        <button
          onClick={() => inputRef.current?.click()}
          title={`Open a Gaussian splat (${ACCEPT.replaceAll(',', ', ')}), or drop one anywhere`}
          className="w-full rounded-md bg-white/10 hover:bg-white/15 px-2 py-1.5 text-xs font-medium text-white/85 hover:text-white transition-colors"
        >
          Open splat
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) s.openFile(f)
            e.target.value = ''   // so picking the same file again still fires
          }}
        />

        {!s.file && !s.error && (
          <div className="mt-1.5 text-[10px] text-white/35 text-center">or drop a file anywhere</div>
        )}

        {s.file && (
          <>
            <div className="mt-2 flex items-center gap-1">
              <span className="flex-1 text-white/85 font-medium truncate" title={s.file.name}>{s.file.name}</span>
              <button onClick={s.close} title="Close the splat" className="text-white/40 hover:text-white text-sm leading-none px-1">×</button>
            </div>
            <div className="flex justify-between tabular-nums text-white/45">
              <span>{formatBytes(s.file.size)}</span>
              {s.status === 'ready' && <span>{s.splatCount.toLocaleString()} splats</span>}
              {s.status === 'loading' && <span>{s.progress < 100 ? `${s.progress}%` : 'Processing…'}</span>}
            </div>
            {s.status === 'loading' && (
              <div className="mt-1 h-1 rounded bg-white/10 overflow-hidden">
                <div className="h-full bg-white/60 transition-[width]" style={{ width: `${s.progress}%` }} />
              </div>
            )}

            {s.status === 'ready' && (
              <>
                <Label>Gizmo{cameraMode !== 'fly' && <span className="text-white/30"> · Fly mode only</span>}</Label>
                <div className="flex rounded-md bg-white/5 p-0.5">
                  {GIZMO_MODES.map(({ mode, label, tip }) => (
                    <button
                      key={mode}
                      title={tip}
                      onClick={() => s.setGizmoMode(mode)}
                      className={[
                        'flex-1 rounded px-1 py-1 font-medium transition-colors',
                        s.gizmoMode === mode ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex gap-1">
                  <button
                    onClick={s.resetTransform}
                    title="Undo all moves and rotations"
                    className="flex-1 rounded-md border border-white/10 px-2 py-1 text-white/60 hover:text-white hover:border-white/25 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={s.frameSplat}
                    title="Fly the camera back to the splat"
                    className="flex-1 rounded-md border border-white/10 px-2 py-1 text-white/60 hover:text-white hover:border-white/25 transition-colors"
                  >
                    Frame
                  </button>
                </div>
              </>
            )}

            <Label>Quality</Label>
            <Slider label="Opacity" value={s.opacity} min={0.2} max={3} step={0.1} onChange={s.setOpacity}
                    format={(v) => v.toFixed(1)} title="1 = as trained; higher makes the splat more solid" />
            <Slider label="Sharpness" value={s.sharpness} min={1} max={3} step={0.1} onChange={s.setSharpness}
                    format={(v) => v.toFixed(1)}
                    title="1 = exact 3DGS; 2 = SuperSplat / PlayCanvas look (crisper edges and textures)" />
            <Slider label="Max splat size" value={s.maxSplatPx} min={16} max={512} step={8} onChange={s.setMaxSplatPx}
                    format={(v) => `${v} px`}
                    title="Largest a single splat may get on screen. Lower it to stop huge smears when flying very close." />
            <div className="mt-1.5 flex gap-1">
              <Toggle on={s.removeFloaters} onClick={() => s.setRemoveFloaters(!s.removeFloaters)} disabled={s.status !== 'ready'}
                      title="Hide stray specks far from the object and oversized fog blobs (undo by turning it off)">Floaters off</Toggle>
              <Toggle on={s.aaTrained} onClick={() => s.setAaTrained(!s.aaTrained)}
                      title="Turn on for files trained with anti-aliasing (Mip-Splatting / gsplat antialiased). Leave off for classic 3DGS.">AA-trained</Toggle>
            </div>
            {s.removeFloaters && s.status === 'ready' && (
              <div className="mt-1 text-[10px] text-white/40 tabular-nums">{s.floatersHidden.toLocaleString()} splats hidden</div>
            )}

            <Label>View</Label>
            <div className="flex gap-1">
              <Toggle on={s.flipped} onClick={s.toggleFlipped} disabled={s.status !== 'ready'}
                      title="Turn the splat upside down (some trainers export it Y-down)">Flip</Toggle>
              <Toggle on={s.showGrid} onClick={() => s.setShowGrid(!s.showGrid)}
                      title="Show the ground grid">Grid</Toggle>
            </div>
          </>
        )}

        {s.error && (
          <div className="mt-2 flex items-start gap-1 text-red-300">
            <span className="flex-1 break-words">{s.error}</span>
            <button onClick={s.clearError} title="Dismiss" className="text-red-300/60 hover:text-red-200 leading-none px-0.5">×</button>
          </div>
        )}
      </div>

      {dragging && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 pointer-events-none">
          <div className="rounded-xl border-2 border-dashed border-white/40 px-10 py-8 text-sm text-white/80">
            Drop to open · {SPLAT_EXTENSIONS.map((e) => '.' + e).join('  ')}
          </div>
        </div>
      )}
    </>
  )
}

// Window-wide drag-and-drop: drop a splat file anywhere on the page to open it.
// Returns whether a file is currently being dragged over the page.
function useFileDrop(openFile: (f: File) => void) {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    // dragenter/leave fire for every child element, so count depth.
    let depth = 0
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth++; setDragging(true) } }
    const onLeave = (e: DragEvent) => { if (hasFiles(e) && --depth <= 0) { depth = 0; setDragging(false) } }
    const onOver  = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault() }   // allow drop
    const onDrop  = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const f = e.dataTransfer?.files[0]
      if (f) openFile(f)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [openFile])

  return dragging
}

function Slider({ label, value, min, max, step, onChange, format, title }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; format: (v: number) => string; title: string
}) {
  return (
    <div className="mb-1.5" title={title}>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-white/45">{label}</span>
        <span className="text-white/70 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-white/80 cursor-pointer"
      />
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mt-2.5 mb-1 text-[10px] text-white/45">{children}</div>
}

function Toggle({ on, onClick, disabled, title, children }: {
  on: boolean; onClick: () => void; disabled?: boolean; title: string; children: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'flex-1 rounded-md px-2 py-1 transition-colors disabled:opacity-40',
        on ? 'bg-white/15 text-white' : 'bg-white/5 text-white/45 hover:text-white/80',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function formatBytes(n: number) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  return Math.max(1, Math.round(n / 1e3)) + ' KB'
}
