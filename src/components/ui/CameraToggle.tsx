import { useUIStore } from '../../store/uiStore'
import type { CameraMode } from '../../store/uiStore'
import { useKeyStore, keyLabel } from '../../store/keyStore'

const MODES: { mode: CameraMode; label: string; tip: string }[] = [
  { mode: 'fly',  label: 'Fly',         tip: 'Free 6-axis camera (keys in Info)' },
  { mode: 'walk', label: 'Ground Walk', tip: 'First-person on the ground (click to lock mouse)' },
]

export function CameraToggle() {
  const { cameraMode, setCameraMode } = useUIStore()
  const b = useKeyStore((s) => s.bindings)

  return (
    <div className="flex gap-1 panel rounded-lg p-1">
      {MODES.map(({ mode, label, tip }) => (
        <button
          key={mode}
          title={`${tip} [${keyLabel(mode === 'fly' ? b.flyMode : b.walkMode)}]`}
          onClick={() => setCameraMode(mode)}
          className={[
            'px-3 py-1 rounded-md text-xs font-medium transition-colors',
            cameraMode === mode
              ? 'bg-white/15 text-white'
              : 'text-white/40 hover:text-white/70',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
