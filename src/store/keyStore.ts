import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// Rebindable keyboard controls. Bindings are KeyboardEvent.code values (layout-
// independent physical keys). Left/right modifier variants are normalised so
// "Shift" means either Shift key. Saved per browser in localStorage.
// ─────────────────────────────────────────────────────────────────────────────

export type Action =
  | 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'fast'
  | 'lookUp' | 'lookDown' | 'lookLeft' | 'lookRight' | 'rollLeft' | 'rollRight'
  | 'flyMode' | 'walkMode'

export const ACTION_GROUPS: { title: string; actions: { id: Action; label: string }[] }[] = [
  {
    title: 'Move',
    actions: [
      { id: 'forward', label: 'Forward' },
      { id: 'back',    label: 'Back' },
      { id: 'left',    label: 'Left' },
      { id: 'right',   label: 'Right' },
      { id: 'up',      label: 'Up (Fly)' },
      { id: 'down',    label: 'Down (Fly)' },
      { id: 'fast',    label: 'Move faster (Fly, hold)' },
    ],
  },
  {
    title: 'Look',
    actions: [
      { id: 'lookUp',    label: 'Look up' },
      { id: 'lookDown',  label: 'Look down' },
      { id: 'lookLeft',  label: 'Look left' },
      { id: 'lookRight', label: 'Look right' },
      { id: 'rollLeft',  label: 'Roll left (Fly)' },
      { id: 'rollRight', label: 'Roll right (Fly)' },
    ],
  },
  {
    title: 'Camera mode',
    actions: [
      { id: 'flyMode',  label: 'Switch to Fly' },
      { id: 'walkMode', label: 'Switch to Ground Walk' },
    ],
  },
]

export type Bindings = Record<Action, string>

export const DEFAULT_BINDINGS: Bindings = {
  forward: 'KeyI', back: 'KeyK', left: 'KeyJ', right: 'KeyL', up: 'KeyU', down: 'KeyN',
  fast: 'ShiftLeft',
  lookUp: 'KeyW', lookDown: 'KeyX', lookLeft: 'KeyA', lookRight: 'KeyD',
  rollLeft: 'KeyQ', rollRight: 'KeyE',
  flyMode: 'KeyF', walkMode: 'KeyG',
}

// Esc always releases the mouse / closes things, so it can't be bound.
export const RESERVED_CODES = new Set(['Escape'])

/** Treat left/right modifier variants as one key. */
export function normCode(code: string): string {
  if (code === 'ShiftRight') return 'ShiftLeft'
  if (code === 'ControlRight') return 'ControlLeft'
  if (code === 'AltRight') return 'AltLeft'
  if (code === 'MetaRight') return 'MetaLeft'
  return code
}

const NAMED: Record<string, string> = {
  ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', MetaLeft: 'Meta', Space: 'Space',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Tab: 'Tab', CapsLock: 'Caps',
  Enter: 'Enter', Backspace: 'Bksp', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
}

/** Short display label for a key code (KeyA → "A", ShiftLeft → "Shift"). */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6)
  return NAMED[code] ?? code
}

const STORAGE_KEY = 'grid.keybindings.v1'

function loadBindings(): Bindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_BINDINGS }
    const saved = JSON.parse(raw) as Partial<Bindings>
    const out = { ...DEFAULT_BINDINGS }
    for (const k of Object.keys(DEFAULT_BINDINGS) as Action[]) {
      if (typeof saved[k] === 'string' && !RESERVED_CODES.has(saved[k]!)) out[k] = normCode(saved[k]!)
    }
    return out
  } catch {
    return { ...DEFAULT_BINDINGS }
  }
}

function saveBindings(b: Bindings) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)) } catch { /* storage blocked — still works this session */ }
}

interface KeyStore {
  bindings: Bindings
  /** Bind `action` to `code`. If another action already uses that key, the two swap. */
  setBinding: (action: Action, code: string) => void
  resetBindings: () => void
  // While the key editor is open, camera controls and hotkeys ignore the keyboard.
  editorOpen: boolean
  setEditorOpen: (v: boolean) => void
}

export const useKeyStore = create<KeyStore>((set) => ({
  bindings: loadBindings(),
  setBinding: (action, rawCode) =>
    set((s) => {
      const code = normCode(rawCode)
      if (RESERVED_CODES.has(code)) return s
      const next = { ...s.bindings }
      const clash = (Object.keys(next) as Action[]).find((a) => a !== action && next[a] === code)
      if (clash) next[clash] = next[action]
      next[action] = code
      saveBindings(next)
      return { bindings: next }
    }),
  resetBindings: () => {
    saveBindings(DEFAULT_BINDINGS)
    set({ bindings: { ...DEFAULT_BINDINGS } })
  },
  editorOpen: false,
  setEditorOpen: (v) => set({ editorOpen: v }),
}))

/** True if the held-key set contains the key bound to `action`. */
export function held(keys: Set<string>, action: Action): boolean {
  return keys.has(useKeyStore.getState().bindings[action])
}
