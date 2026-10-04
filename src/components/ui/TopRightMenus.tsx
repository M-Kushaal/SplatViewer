import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GridSettings } from './GridSettings'
import { InfoPanel } from './InfoPanel'
import { KeyboardModal } from './KeyboardModal'

type Section = 'grid' | 'info'

// Top-right settings box: one dark panel with the sections stacked vertically —
// Grid settings (expands in place), Change keys (opens the keyboard popup) and
// Info (expands in place). One section open at a time; a click anywhere outside
// collapses it (without swallowing the click, so camera drags still work).
export function TopRightMenus() {
  const [open, setOpen] = useState<Section | null>(null)
  const [keysOpen, setKeysOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const toggle = (s: Section) => setOpen((o) => (o === s ? null : s))

  return (
    <>
      <div
        ref={rootRef}
        // Pinned to the right, so the wider Info section grows the box leftward.
        className={[
          'absolute top-3 right-3 z-20 menu-box rounded-xl overflow-y-auto',
          open === 'info' ? 'w-[400px]' : 'w-64',
        ].join(' ')}
        style={{ maxHeight: 'calc(100% - 24px)', maxWidth: 'calc(100% - 24px)' }}
      >
        <Row label="Grid settings" open={open === 'grid'} onClick={() => toggle('grid')} />
        {open === 'grid' && <Body><GridSettings /></Body>}

        <Row label="Change keys" icon="⌨" onClick={() => { setOpen(null); setKeysOpen(true) }} />

        <Row label="Info" open={open === 'info'} onClick={() => toggle('info')} />
        {open === 'info' && <Body><InfoPanel /></Body>}
      </div>

      {/* Rendered outside the box: its backdrop-filter would trap a fixed overlay. */}
      {keysOpen && <KeyboardModal onClose={() => setKeysOpen(false)} />}
    </>
  )
}

function Row({ label, open, icon, onClick }: { label: string; open?: boolean; icon?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors',
        'border-b border-white/[0.06] last:border-b-0',
        open ? 'text-white bg-white/[0.04]' : 'text-white/70 hover:text-white hover:bg-white/[0.03]',
      ].join(' ')}
    >
      {label}
      {icon
        ? <span className="text-[13px] text-white/50">{icon}</span>
        : <span className={['text-[9px] transition-transform', open ? 'rotate-180' : ''].join(' ')}>▼</span>}
    </button>
  )
}

function Body({ children }: { children: ReactNode }) {
  return <div className="px-3 pt-2 pb-3 border-b border-white/[0.06]">{children}</div>
}
