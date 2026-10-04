import { useUIStore } from '../../store/uiStore'
import type { CameraMode } from '../../store/uiStore'
import { useKeyStore, keyLabel } from '../../store/keyStore'
import type { Action, Bindings } from '../../store/keyStore'

interface ControlRow { keys: string; action: string }
interface ModeHelp {
  mode: CameraMode
  title: string
  shortcut: string
  blurb: string
  controls: ControlRow[]
}

// Built from the live key bindings so the reference always matches the keys.
function buildHelp(b: Bindings): ModeHelp[] {
  const k = (a: Action) => keyLabel(b[a])
  const move = `${k('forward')} / ${k('left')} / ${k('back')} / ${k('right')}`
  return [
    {
      mode: 'fly',
      title: 'Fly',
      shortcut: k('flyMode'),
      blurb: 'Free 6-axis camera — move and turn with the keyboard or mouse.',
      controls: [
        { keys: 'Drag mouse',                          action: 'Look around' },
        { keys: move,                                  action: 'Move forward / left / back / right' },
        { keys: `${k('up')} / ${k('down')}`,           action: 'Move up / down' },
        { keys: `${k('lookUp')} / ${k('lookDown')}`,   action: 'Look up / down' },
        { keys: `${k('lookLeft')} / ${k('lookRight')}`, action: 'Look left / right' },
        { keys: `${k('rollLeft')} / ${k('rollRight')}`, action: 'Roll left / right' },
        { keys: k('fast'),                             action: 'Move faster (default is calm)' },
      ],
    },
    {
      mode: 'walk',
      title: 'Ground Walk',
      shortcut: k('walkMode'),
      blurb: 'First-person, at human eye height (1.75 m on the ground).',
      controls: [
        { keys: 'Click viewport',                       action: 'Lock the mouse to look around' },
        { keys: 'Mouse',                                action: 'Look around (once locked)' },
        { keys: `${k('lookUp')} / ${k('lookDown')}`,    action: 'Look up / down' },
        { keys: `${k('lookLeft')} / ${k('lookRight')}`, action: 'Look left / right' },
        { keys: move,                                   action: 'Walk forward / left / back / right' },
        { keys: 'Esc',                                  action: 'Release the mouse' },
      ],
    },
  ]
}

// Camera controls reference, shown inside the "Info" dropdown.
export function InfoPanel() {
  const cameraMode = useUIStore((s) => s.cameraMode)
  const bindings = useKeyStore((s) => s.bindings)

  return (
    <>
      <div className="space-y-3">
        {buildHelp(bindings).map((h) => {
          const active = h.mode === cameraMode
          return (
            <div
              key={h.mode}
              className={[
                'rounded-lg p-2 border',
                active ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/5',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-medium text-xs">{h.title}</span>
                <span className="text-white/45 text-[11px]">(Shortcut:{h.shortcut})</span>
                {active && (
                  <span className="text-[9px] uppercase tracking-wide text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">
                    Active
                  </span>
                )}
              </div>
              <p className="text-white/40 text-[11px] mb-1.5 leading-snug">{h.blurb}</p>
              <div className="space-y-1">
                {h.controls.map((c) => (
                  <div key={c.keys} className="flex items-start gap-2 text-[11px]">
                    <kbd className="shrink-0 bg-white/10 text-white/80 rounded px-1.5 py-0.5 font-mono text-[10px]">
                      {c.keys}
                    </kbd>
                    <span className="text-white/55 leading-snug">{c.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg p-2 border border-white/5 mt-3">
        <div className="text-white font-medium text-xs mb-1">Splats</div>
        <p className="text-white/40 text-[11px] mb-1.5 leading-snug">
          Open a .ply, .splat, .ksplat or .spz with "Open splat" (left), or drop the file anywhere.
        </p>
        <div className="space-y-1">
          {[
            ['Move / Rotate', 'Drag the coloured arrows / rings on the splat (Fly mode)'],
            ['Reset', 'Undo all moves and rotations'],
            ['Frame', 'Fly the camera back to the splat'],
            ['Opacity', 'Make the splat more solid'],
            ['Floaters off', 'Hide stray specks and haze (turn off to undo)'],
            ['AA-trained', 'For files trained with anti-aliasing'],
            ['Flip', 'Turn it upside down if it loaded that way'],
          ].map(([keys, action]) => (
            <div key={keys} className="flex items-start gap-2 text-[11px]">
              <kbd className="shrink-0 bg-white/10 text-white/80 rounded px-1.5 py-0.5 font-mono text-[10px]">{keys}</kbd>
              <span className="text-white/55 leading-snug">{action}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-white/25 text-[10px] mt-2 leading-snug">
        Tip: Switch modes with the buttons up top, or press <kbd className="bg-white/10 rounded px-1">{keyLabel(bindings.flyMode)}</kbd> (fly) / <kbd className="bg-white/10 rounded px-1">{keyLabel(bindings.walkMode)}</kbd> (ground walk). Change any key with "Change keys".
      </p>
    </>
  )
}
