import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useViewStore } from '../../store/viewStore'
import { useSplatStore } from '../../store/splatStore'
import { RAD2DEG, DEG2RAD } from '../../math'

// Publishes live camera info to the view store (scale bar, axis gizmo, HUD),
// and applies manual poses requested from the HUD / Home button.
const _dir = new THREE.Vector3()
const _toFocus = new THREE.Vector3()
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')

export function ScaleTracker() {
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const setMpp = useViewStore((s) => s.setMetersPerPixel)
  const setQuat = useViewStore((s) => s.setQuat)
  const setCamReadout = useViewStore((s) => s.setCamReadout)
  const pending = useViewStore((s) => s.pending)
  const clearPending = useViewStore((s) => s.clearPending)

  const lastRef = useRef(0)
  const lastQuatRef = useRef(new THREE.Quaternion())
  const lastPosRef = useRef(new THREE.Vector3(Infinity, 0, 0))

  // Apply a manually-entered pose (HUD inputs / Home button).
  useEffect(() => {
    if (!pending) return
    camera.position.set(pending.pos[0], pending.pos[1], pending.pos[2])
    _euler.set(pending.angles[0] * DEG2RAD, pending.angles[1] * DEG2RAD, pending.angles[2] * DEG2RAD, 'YXZ')
    camera.quaternion.setFromEuler(_euler)
    camera.updateMatrixWorld()
    clearPending()
  }, [pending, camera, clearPending])

  useFrame(({ camera }) => {
    const cam = camera as THREE.PerspectiveCamera
    cam.getWorldDirection(_dir)

    // Update readout when the orientation OR position changes noticeably.
    const rotChanged = Math.abs(cam.quaternion.dot(lastQuatRef.current)) < 0.99995
    const posChanged = cam.position.distanceToSquared(lastPosRef.current) > 0.0001   // 1 cm
    if (rotChanged) {
      lastQuatRef.current.copy(cam.quaternion)
      const q = cam.quaternion
      setQuat([q.x, q.y, q.z, q.w])
    }
    if (rotChanged || posChanged) {
      lastPosRef.current.copy(cam.position)
      _euler.setFromQuaternion(cam.quaternion, 'YXZ')
      setCamReadout(
        [round2(cam.position.x), round2(cam.position.y), round2(cam.position.z)],
        [round1(_euler.x * RAD2DEG), round1(_euler.y * RAD2DEG), round1(_euler.z * RAD2DEG)],
      )
    }

    // Metres-per-pixel at the centre of view (scale bar): at the splat's depth
    // when one is open, else where the view ray hits the ground.
    let focusDist = Math.max(0.01, Math.abs(cam.position.y))
    const focus = useSplatStore.getState().focus
    if (focus) {
      _toFocus.set(focus[0], focus[1], focus[2]).sub(cam.position)
      focusDist = Math.max(_toFocus.dot(_dir), 0.01)
    } else if (_dir.y < -1e-3) {
      const t = -cam.position.y / _dir.y
      if (t > 0 && t < 1e6) focusDist = Math.max(t, 0.01)   // eye at floor level → t≈0 → "0 mm" bar
    }
    const fov = (cam.fov * Math.PI) / 180
    const mpp = (2 * Math.tan(fov / 2) * focusDist) / size.height
    const last = lastRef.current
    if (last === 0 || Math.abs(mpp - last) / last > 0.005) {
      lastRef.current = mpp
      setMpp(mpp)
    }
  })

  return null
}

function round2(v: number) {
  return Math.round(v * 100) / 100
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}
