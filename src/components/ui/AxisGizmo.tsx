import * as THREE from 'three'
import { useViewStore } from '../../store/viewStore'

// Premium DOM orientation gizmo (bottom-right). Lives outside the 3D render so
// it's crisp and always visible — including High-quality mode where a 3D gizmo
// would be hidden by post-processing.

const SIZE = 78
const C = SIZE / 2          // centre
const LEN = C - 15          // axis length
const POS_R = 8             // positive knob radius
const NEG_R = 4             // negative knob radius

interface AxisDef { axis: 'X' | 'Y' | 'Z'; v: [number, number, number]; color: string }
const AXES: AxisDef[] = [
  { axis: 'X', v: [1, 0, 0], color: '#ff6b72' },
  { axis: 'Y', v: [0, 1, 0], color: '#7ad17f' },
  { axis: 'Z', v: [0, 0, 1], color: '#6f9bff' },
]

interface Knob {
  x: number; y: number; z: number
  color: string; label: string; positive: boolean
}

export function AxisGizmo() {
  const quat = useViewStore((s) => s.quat)
  const inv = new THREE.Quaternion(quat[0], quat[1], quat[2], quat[3]).invert()

  // Build both ends of each axis in view space.
  const knobs: Knob[] = []
  for (const a of AXES) {
    const view = new THREE.Vector3(...a.v).applyQuaternion(inv)
    knobs.push({ x: C + view.x * LEN, y: C - view.y * LEN, z: view.z, color: a.color, label: a.axis, positive: true })
    knobs.push({ x: C - view.x * LEN, y: C + view.y * LEN, z: -view.z, color: a.color, label: a.axis, positive: false })
  }
  // Draw far knobs first (painter's algorithm).
  knobs.sort((p, q) => p.z - q.z)

  return (
    <div className="absolute bottom-4 right-4 z-10 pointer-events-none select-none">
      <svg
        width={SIZE}
        height={SIZE}
        shapeRendering="geometricPrecision"
        style={{ overflow: 'visible' }}
      >
        {/* Subtle backdrop */}
        <circle cx={C} cy={C} r={C - 1} fill="rgba(16,17,20,0.55)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

        {knobs.map((k, i) => {
          const dim = k.z < -0.15
          if (k.positive) {
            return (
              <g key={i} opacity={dim ? 0.5 : 1}>
                <line
                  x1={C} y1={C} x2={k.x} y2={k.y}
                  stroke={k.color} strokeWidth={2.25} strokeLinecap="round"
                />
                <circle cx={k.x} cy={k.y} r={POS_R} fill={k.color} />
                <text
                  x={k.x} y={k.y + 3.2}
                  textAnchor="middle" fontSize={10} fontWeight={800}
                  fill="#0b0b0d" style={{ letterSpacing: 0.2 }}
                >
                  {k.label}
                </text>
              </g>
            )
          }
          // Negative end: small hollow knob, no line, no label.
          return (
            <circle
              key={i}
              cx={k.x} cy={k.y} r={NEG_R}
              fill="rgba(16,17,20,0.9)"
              stroke={k.color} strokeWidth={1.75}
              opacity={dim ? 0.55 : 0.9}
            />
          )
        })}
      </svg>
    </div>
  )
}
