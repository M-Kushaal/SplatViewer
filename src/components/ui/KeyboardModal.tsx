import { useEffect, useState } from 'react'
import { useKeyStore, ACTION_GROUPS, keyLabel, normCode, RESERVED_CODES } from '../../store/keyStore'
import type { Action } from '../../store/keyStore'

// ─────────────────────────────────────────────────────────────────────────────
// "Change keys" popup: an on-screen keyboard with every bound key highlighted,
// next to the list of actions. Pick an action, then press a key (or click one
// on the keyboard) to rebind it. A key that's already taken swaps over.
// ─────────────────────────────────────────────────────────────────────────────

// Tiny tags drawn inside bound keys.
const SHORT: Record<Action, string> = {
  forward: 'Fwd', back: 'Back', left: 'Left', right: 'Right', up: 'Up', down: 'Down', fast: 'Fast',
  lookUp: 'Look↑', lookDown: 'Look↓', lookLeft: 'Look←', lookRight: 'Look→',
  rollLeft: 'Roll←', rollRight: 'Roll→', flyMode: 'Fly', walkMode: 'Walk',
}

// [code, width in key units]. Right-hand modifiers are drawn but normalise to the left ones.
type K = [string, number]
const ROWS: K[][] = [
  [['Backquote', 1], ['Digit1', 1], ['Digit2', 1], ['Digit3', 1], ['Digit4', 1], ['Digit5', 1], ['Digit6', 1],
   ['Digit7', 1], ['Digit8', 1], ['Digit9', 1], ['Digit0', 1], ['Minus', 1], ['Equal', 1], ['Backspace', 2]],
  [['Tab', 1.5], ['KeyQ', 1], ['KeyW', 1], ['KeyE', 1], ['KeyR', 1], ['KeyT', 1], ['KeyY', 1], ['KeyU', 1],
   ['KeyI', 1], ['KeyO', 1], ['KeyP', 1], ['BracketLeft', 1], ['BracketRight', 1], ['Backslash', 1.5]],
  [['CapsLock', 1.75], ['KeyA', 1], ['KeyS', 1], ['KeyD', 1], ['KeyF', 1], ['KeyG', 1], ['KeyH', 1], ['KeyJ', 1],
   ['KeyK', 1], ['KeyL', 1], ['Semicolon', 1], ['Quote', 1], ['Enter', 2.25]],
  [['ShiftLeft', 2.25], ['KeyZ', 1], ['KeyX', 1], ['KeyC', 1], ['KeyV', 1], ['KeyB', 1], ['KeyN', 1], ['KeyM', 1],
   ['Comma', 1], ['Period', 1], ['Slash', 1], ['ShiftRight', 2.75]],
  [['ControlLeft', 1.5], ['AltLeft', 1.5], ['Space', 7], ['AltRight', 1.5], ['ControlRight', 1.5],
   ['ArrowLeft', 1], ['ArrowUp', 1], ['ArrowDown', 1], ['ArrowRight', 1]],
]
const UNIT = 36   // px per key unit (gap included)

function actionLabel(a: Action) {
  for (const g of ACTION_GROUPS) for (const x of g.actions) if (x.id === a) return x.label
  return a
}

export function KeyboardModal({ onClose }: { onClose: () => void }) {
  const bindings = useKeyStore((s) => s.bindings)
  const setBinding = useKeyStore((s) => s.setBinding)
  const resetBindings = useKeyStore((s) => s.resetBindings)
  const setEditorOpen = useKeyStore((s) => s.setEditorOpen)
  const [selected, setSelected] = useState<Action | null>(null)

  // code → action that uses it
  const byCode = new Map<string, Action>()
  for (const a of Object.keys(bindings) as Action[]) byCode.set(bindings[a], a)

  // Camera + hotkeys ignore the keyboard while this is open.
  useEffect(() => {
    setEditorOpen(true)
    return () => setEditorOpen(false)
  }, [setEditorOpen])

  // Capture physical key presses before anything else sees them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        if (selected) setSelected(null)
        else onClose()
        return
      }
      if (selected) {
        setBinding(selected, e.code)
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [selected, setBinding, onClose])

  const clickKey = (code: string) => {
    const c = normCode(code)
    if (RESERVED_CODES.has(c)) return
    if (selected) {
      setBinding(selected, c)
      setSelected(null)
    } else {
      const a = byCode.get(c)
      if (a) setSelected(a)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" onPointerDown={onClose}>
      <div
        className="menu-box rounded-2xl p-4 shadow-2xl max-w-full max-h-full overflow-auto"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/90 font-semibold text-sm">Change keys</span>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xs">✕</button>
        </div>
        <p className="text-[11px] mb-3 h-4">
          {selected ? (
            <span className="text-amber-300">
              Press a key for <b>{actionLabel(selected)}</b>, or click one on the keyboard (Esc to cancel)
            </span>
          ) : (
            <span className="text-white/45">
              Highlighted keys are in use. Pick an action (or a highlighted key), then press the new key.
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-5 items-start">
          {/* ── On-screen keyboard ── */}
          <div className="shrink-0">
            {ROWS.map((row, i) => (
              <div key={i} className="flex" style={{ marginBottom: 4 }}>
                {row.map(([code, w]) => {
                  const c = normCode(code)
                  const action = byCode.get(c)
                  const isSel = selected !== null && action === selected
                  const reserved = RESERVED_CODES.has(c)
                  return (
                    <button
                      key={code}
                      onClick={() => clickKey(code)}
                      title={action ? actionLabel(action) : keyLabel(c)}
                      disabled={reserved}
                      style={{ width: w * UNIT - 4, height: UNIT - 4, marginRight: 4 }}
                      className={[
                        'rounded-md border flex flex-col items-center justify-center leading-none transition-colors',
                        isSel
                          ? 'bg-amber-400/30 border-amber-300 text-white ring-2 ring-amber-300/60'
                          : action
                            ? 'bg-amber-400/10 border-amber-400/50 text-amber-100 hover:bg-amber-400/20'
                            : selected
                              ? 'bg-white/[0.04] border-white/15 text-white/70 hover:bg-white/15 hover:text-white'
                              : 'bg-white/[0.03] border-white/10 text-white/40',
                      ].join(' ')}
                    >
                      <span className="text-[11px] font-medium">{keyLabel(c)}</span>
                      {action && <span className="text-[8px] mt-0.5 text-amber-200/80">{SHORT[action]}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* ── Actions list ── */}
          <div className="w-56 shrink-0 space-y-3">
            {ACTION_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="text-white/35 text-[10px] uppercase tracking-wide mb-1">{g.title}</div>
                {g.actions.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setSelected(selected === id ? null : id)}
                    className={[
                      'w-full flex items-center justify-between rounded-md px-2 py-1 text-[11px] transition-colors',
                      selected === id ? 'bg-amber-400/15 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
                    ].join(' ')}
                  >
                    <span>{label}</span>
                    <kbd
                      className={[
                        'rounded px-1.5 py-0.5 font-mono text-[10px]',
                        selected === id ? 'bg-amber-300 text-black animate-pulse' : 'bg-white/10 text-white/80',
                      ].join(' ')}
                    >
                      {selected === id ? '…' : keyLabel(bindings[id])}
                    </kbd>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <button
            onClick={() => { resetBindings(); setSelected(null) }}
            className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-white/60 hover:text-white hover:border-white/25 transition-colors"
          >
            Reset keys to default
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-white/10 px-4 py-1 text-[11px] font-medium text-white/85 hover:bg-white/20 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
