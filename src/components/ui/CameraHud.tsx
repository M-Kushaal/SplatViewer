import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useViewStore } from '../../store/viewStore'
import { RAD2DEG } from '../../math'

// Live camera position + angle readout that you can also edit manually.
// Fields show live values; while you're editing one they stop auto-updating so
// they don't jump under your cursor. Commit with Enter or by clicking away.

const HOME_POS: [number, number, number] = [55, 42, 55]

// Angles that look at the origin from HOME_POS (computed once).
const HOME_ANGLES: [number, number, number] = (() => {
  const m = new THREE.Matrix4().lookAt(
    new THREE.Vector3(...HOME_POS), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0),
  )
  const e = new THREE.Euler().setFromRotationMatrix(m, 'YXZ')
  return [Math.round(e.x * RAD2DEG * 10) / 10, Math.round(e.y * RAD2DEG * 10) / 10, Math.round(e.z * RAD2DEG * 10) / 10]
})()

const FIELDS = [
  { label: 'X', unit: 'm' }, { label: 'Y', unit: 'm' }, { label: 'Z', unit: 'm' },
  { label: 'Pitch', unit: '°' }, { label: 'Yaw', unit: '°' }, { label: 'Roll', unit: '°' },
]

export function CameraHud() {
  const camPos = useViewStore((s) => s.camPos)
  const camAngles = useViewStore((s) => s.camAngles)
  const applyPose = useViewStore((s) => s.applyPose)

  // Fields hold the raw text so partial entries like "-" or "1." can be typed;
  // they're parsed on commit, and anything unparseable keeps the live value.
  const live = [...camPos, ...camAngles]
  const [vals, setVals] = useState<string[]>(live.map(String))
  const focusedRef = useRef(false)
  const cancelRef = useRef(false)

  // Sync from live camera unless the user is mid-edit.
  useEffect(() => {
    if (!focusedRef.current) setVals([...camPos, ...camAngles].map(String))
  }, [camPos, camAngles])

  const commit = (text: string[]) => {
    const n = text.map((t, i) => { const v = parseFloat(t); return isFinite(v) ? v : live[i] })
    setVals(n.map(String))
    applyPose([n[0], n[1], n[2]], [n[3], n[4], n[5]])
  }

  const goHome = () => {
    setVals([...HOME_POS, ...HOME_ANGLES].map(String))
    applyPose(HOME_POS, HOME_ANGLES)
  }

  return (
    <div className="absolute top-3 left-3 z-10 panel rounded-lg p-2 w-[188px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/50 text-[10px] font-semibold tracking-wide uppercase">Camera</span>
        <button
          onClick={goHome}
          title="Return to origin"
          className="text-white/60 hover:text-white text-xs px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
        >
          ⌂ Origin
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {FIELDS.map((f, i) => (
          <label key={f.label} className="flex flex-col gap-0.5">
            <span className="text-white/35 text-[9px] leading-none">{f.label}</span>
            <input
              type="number"
              value={vals[i]}
              onFocus={() => { focusedRef.current = true }}
              onBlur={() => {
                focusedRef.current = false
                if (cancelRef.current) { cancelRef.current = false; setVals(live.map(String)) }
                else commit(vals)
              }}
              onChange={(e) => {
                const n = [...vals]; n[i] = e.target.value; setVals(n)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelRef.current = true    // Esc = discard the edit
                if (e.key === 'Enter' || e.key === 'Escape') (e.target as HTMLInputElement).blur()
              }}
              className="w-full bg-black/30 text-white/85 text-[11px] rounded px-1 py-0.5 tabular-nums
                         outline-none focus:bg-black/50 focus:ring-1 focus:ring-white/20
                         [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
          </label>
        ))}
      </div>
    </div>
  )
}
