import { useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useKeyStore, normCode } from '../../store/keyStore'

// Global keyboard shortcuts.
// Lives in the UI layer (not inside Canvas) so it works regardless of 3D focus.
// Mode keys come from the (rebindable) key bindings.

export function HotkeyHandler() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire hotkeys when the user is typing in an input
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== 'range') ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const { bindings, editorOpen } = useKeyStore.getState()
      if (editorOpen) return
      const code = normCode(e.code)
      const ui = useUIStore.getState()
      if (code === bindings.flyMode) ui.setCameraMode('fly')
      else if (code === bindings.walkMode) ui.setCameraMode('walk')
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return null
}
