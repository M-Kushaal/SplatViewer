import { useUIStore } from '../../store/uiStore'
import { useKeyStore, keyLabel } from '../../store/keyStore'

// Shows a brief hint when entering walk mode so users know to click.
// Disappears once they've clicked (pointer lock activates).

export function WalkModeHint() {
  const { cameraMode } = useUIStore()
  const b = useKeyStore((s) => s.bindings)
  if (cameraMode !== 'walk') return null

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 panel rounded-lg px-4 py-2 text-white/60 text-xs pointer-events-none">
      Click viewport to lock mouse · ESC to release · {[b.forward, b.left, b.back, b.right].map(keyLabel).join(' ')} to move
    </div>
  )
}
