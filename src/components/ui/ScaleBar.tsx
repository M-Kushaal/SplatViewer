import { useViewStore } from '../../store/viewStore'

// Map-style scale bar: a bar of "nice" real-world length (1/2/5 × 10ⁿ) that
// tells you what the grid spacing actually means at the current zoom.

const TARGET_PX = 110   // aim for roughly this bar width

function niceDistance(meters: number): number {
  const exp = Math.floor(Math.log10(meters))
  const base = Math.pow(10, exp)
  const frac = meters / base
  const niceFrac = frac >= 5 ? 5 : frac >= 2 ? 2 : 1
  return niceFrac * base
}

function formatDistance(m: number): string {
  if (m >= 1000) {
    const km = m / 1000
    return `${km % 1 === 0 ? km : km.toFixed(1)} km`
  }
  if (m >= 1) return `${m % 1 === 0 ? m : m.toFixed(1)} m`
  if (m >= 0.01) return `${Math.round(m * 100)} cm`
  return `${Math.round(m * 1000)} mm`
}

export function ScaleBar() {
  const mpp = useViewStore((s) => s.metersPerPixel)
  if (!mpp || !isFinite(mpp)) return null

  const rawMeters = TARGET_PX * mpp
  const meters = niceDistance(rawMeters)
  const barPx = Math.round(meters / mpp)

  return (
    <div className="absolute bottom-6 left-4 z-10 pointer-events-none select-none">
      <div
        className="text-white/80 text-[11px] font-medium text-center mb-1 tabular-nums"
        style={{ width: barPx }}
      >
        {formatDistance(meters)}
      </div>
      {/* Bar with end ticks (map style) */}
      <div className="relative h-2" style={{ width: barPx }}>
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-white/75" />
        <div className="absolute bottom-0 left-0 h-2 w-[2px] bg-white/75" />
        <div className="absolute bottom-0 right-0 h-2 w-[2px] bg-white/75" />
      </div>
    </div>
  )
}
