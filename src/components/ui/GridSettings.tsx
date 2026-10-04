import { useUIStore } from '../../store/uiStore'

// Contents of the "Grid settings" dropdown: render quality + live sliders for
// scene illumination, grid-line intensity + thickness, and axis glow, plus a reset.
// Values are shown so you can dial in the look and read off the numbers.

interface Row {
  label: string
  value: number
  set: (v: number) => void
  min: number
  max: number
  step: number
}

export function GridSettings() {
  const s = useUIStore()

  const rows: Row[] = [
    { label: 'Light',     value: s.sceneIllumination, set: s.setSceneIllumination, min: 0,   max: 3, step: 0.05 },
    { label: 'Grid',      value: s.gridIntensity,     set: s.setGridIntensity,     min: 0,   max: 2, step: 0.05 },
    { label: 'Thickness', value: s.gridLineWidth,     set: s.setGridLineWidth,     min: 0.1, max: 3, step: 0.05 },
    { label: 'Axis glow', value: s.axisGlow,          set: s.setAxisGlow,          min: 0,   max: 2, step: 0.02 },
  ]

  return (
    <>
      {/* Quality: Low = no shadows / post-processing (integrated-GPU friendly); High = shadows + tone mapping */}
      <div className="mb-3">
        <div className="text-white/45 text-[10px] mb-1">Quality</div>
        <div className="flex rounded-md bg-white/5 p-0.5" title="Low is best for laptops / integrated graphics.">
          {(['low', 'high'] as const).map((q) => (
            <button
              key={q}
              onClick={() => s.setQuality(q)}
              className={[
                'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
                s.quality === q
                  ? (q === 'high' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300')
                  : 'text-white/50 hover:text-white',
              ].join(' ')}
            >
              {q === 'high' ? 'High' : 'Low'}
            </button>
          ))}
        </div>
      </div>

      {rows.map((r) => (
        <div key={r.label} className="mb-1.5 last:mb-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-white/45 text-[10px]">{r.label}</span>
            <span className="text-white/70 text-[10px] tabular-nums">{r.value.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={r.min}
            max={r.max}
            step={r.step}
            value={r.value}
            onChange={(e) => r.set(parseFloat(e.target.value))}
            className="w-full h-1 accent-white/80 cursor-pointer"
          />
        </div>
      ))}

      <button
        onClick={s.resetDisplay}
        className="mt-3 w-full rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/60 hover:text-white hover:border-white/25 transition-colors"
      >
        Reset to defaults
      </button>
    </>
  )
}
