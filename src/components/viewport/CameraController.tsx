import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useUIStore } from '../../store/uiStore'
import { useKeyStore, normCode, held } from '../../store/keyStore'
import { useSplatStore } from '../../store/splatStore'

// ── Fly camera — the all-in-one navigator ──────────────────────────────────────
// Move: IJKL + U/N.  Look: W/X (pitch) A/D (yaw) + Q/E roll, OR drag the mouse.
// (Those are the defaults; every key is rebindable via keyStore.)
// Yaw is around WORLD-up and pitch around the local axis, so the horizon stays
// level (roll is only ever added deliberately via Q/E).
function FlyCamera() {
  const { camera, gl } = useThree()
  const keysRef = useRef<Set<string>>(new Set())
  const dragRef = useRef(false)

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (!ignoreKey(e)) keysRef.current.add(normCode(e.code)) }
    const onUp   = (e: KeyboardEvent) => keysRef.current.delete(normCode(e.code))
    // A keyup is lost if the window loses focus mid-press — drop held keys or the camera drifts on return.
    const onBlur = () => keysRef.current.clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    window.addEventListener('blur',    onBlur)

    // Mouse look: drag to turn the view.
    const el = gl.domElement
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0 || e.button === 2) dragRef.current = true
    }
    const onPointerUp   = () => { dragRef.current = false }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragRef.current || useSplatStore.getState().gizmoDragging) return   // gizmo handle has the mouse
      yawWorld(camera, -e.movementX * 0.0026)   // yaw around world-up
      pitchLocal(camera, -e.movementY * 0.0026)  // pitch around local-right
    }
    const onCtx = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    el.addEventListener('contextmenu', onCtx)

    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
      window.removeEventListener('blur',    onBlur)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('contextmenu', onCtx)
    }
  }, [gl, camera])

  useFrame((_, deltaRaw) => {
    const keys = keysRef.current

    // On-demand rendering pauses the loop when idle, so the first frame after a
    // keypress can carry a huge delta (all the idle time). Cap it or the camera
    // lurches before settling into smooth motion.
    const delta = Math.min(deltaRaw, 0.05)

    // ── Look via keyboard ──
    const rot = 1.4 * delta
    if (held(keys, 'lookUp'))    pitchLocal(camera,  rot)
    if (held(keys, 'lookDown'))  pitchLocal(camera, -rot)
    if (held(keys, 'lookLeft'))  yawWorld(camera,  rot)
    if (held(keys, 'lookRight')) yawWorld(camera, -rot)
    if (held(keys, 'rollLeft'))  rollLocal(camera,  rot)
    if (held(keys, 'rollRight')) rollLocal(camera, -rot)

    // ── Move along the camera's local axes (calm by default; Shift = fast) ──
    const fast = held(keys, 'fast')
    // With a splat open, scale speed to its size so a 2 m object and a 200 m
    // street are both comfortable to fly around.
    const r = useSplatStore.getState().radius
    const scale = r > 0 ? THREE.MathUtils.clamp(r / 25, 0.001, 4) : 1   // 10 cm object → ~0.1 m/s
    const speed = (fast ? 120 : 30) * scale * delta
    const dir = new THREE.Vector3()
    if (held(keys, 'forward')) dir.z -= 1
    if (held(keys, 'back'))    dir.z += 1
    if (held(keys, 'left'))    dir.x -= 1
    if (held(keys, 'right'))   dir.x += 1
    if (held(keys, 'down'))    dir.y -= 1
    if (held(keys, 'up'))      dir.y += 1
    if (dir.lengthSq() > 0) {
      dir.normalize().applyQuaternion(camera.quaternion)
      camera.position.addScaledVector(dir, speed)
    }
  })

  return null
}

// Yaw around world-up (keeps horizon level); pitch/roll around local axes.
function yawWorld(camera: THREE.Camera, a: number) {
  camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Y, a))
}
function pitchLocal(camera: THREE.Camera, a: number) {
  camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_X, a))
}
function rollLocal(camera: THREE.Camera, a: number) {
  camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(AXIS_Z, a))
}

// Keys typed into a text field (e.g. the Camera panel numbers) or pressed while
// the key editor is open must not move the camera.
function ignoreKey(e: KeyboardEvent) {
  const t = e.target
  return useKeyStore.getState().editorOpen ||
    (t instanceof HTMLInputElement && t.type !== 'range') ||   // a focused slider shouldn't eat camera keys
    t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement
}

const AXIS_X = new THREE.Vector3(1, 0, 0)
const AXIS_Y = new THREE.Vector3(0, 1, 0)
const AXIS_Z = new THREE.Vector3(0, 0, 1)

// ── Walk camera (gravity-locked to ground Y=0 for now) ────────────────────
function WalkCamera() {
  const { camera, gl } = useThree()
  const keysRef   = useRef<Set<string>>(new Set())
  const lockedRef = useRef(false)
  const yawRef    = useRef(0)
  const pitchRef  = useRef(0)
  const lastQuat  = useRef(new THREE.Quaternion())

  // On entering walk mode: keep current X/Z, snap down to standing height on
  // the ground, and continue looking the same direction (level the pitch a bit).
  useEffect(() => {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
    yawRef.current = e.y
    pitchRef.current = THREE.MathUtils.clamp(e.x, -Math.PI / 3, Math.PI / 3)
    camera.quaternion.setFromEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ'))
    lastQuat.current.copy(camera.quaternion)
    camera.position.y = 1.75   // snap to ground at current X, Z
  }, [camera])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (!ignoreKey(e)) keysRef.current.add(normCode(e.code))
      if (e.code === 'Escape') {
        lockedRef.current = false
        document.exitPointerLock()
      }
    }
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(normCode(e.code))

    const onClick = () => {
      gl.domElement.requestPointerLock()
    }

    const onPointerLockChange = () => {
      lockedRef.current = document.pointerLockElement === gl.domElement
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!lockedRef.current) return
      yawRef.current   -= e.movementX * 0.002
      pitchRef.current -= e.movementY * 0.002
      pitchRef.current  = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitchRef.current))
    }

    const onBlur = () => keysRef.current.clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    window.addEventListener('blur',    onBlur)
    window.addEventListener('mousemove', onMouseMove)
    gl.domElement.addEventListener('click', onClick)
    document.addEventListener('pointerlockchange', onPointerLockChange)

    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
      window.removeEventListener('blur',    onBlur)
      window.removeEventListener('mousemove', onMouseMove)
      gl.domElement.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      // Release the mouse when leaving Walk so the next mode (e.g. Orbit)
      // doesn't receive locked-pointer events and drag erratically.
      if (document.pointerLockElement) document.exitPointerLock()
    }
  }, [gl])

  useFrame((_, deltaRaw) => {
    const delta = Math.min(deltaRaw, 0.05)   // avoid a lurch on the first frame after idle

    // ── Look via keyboard (same keys as Fly; no roll — a walker's head stays level) ──
    const keys = keysRef.current
    // A pose set from outside (Camera panel, Origin) changed the camera since our
    // last frame — adopt its angles instead of snapping back to ours.
    if (Math.abs(camera.quaternion.dot(lastQuat.current)) < 0.99999) {
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
      yawRef.current = e.y
      pitchRef.current = e.x
    }

    const rot = 1.4 * delta
    if (held(keys, 'lookUp'))    pitchRef.current += rot
    if (held(keys, 'lookDown'))  pitchRef.current -= rot
    if (held(keys, 'lookLeft'))  yawRef.current   += rot
    if (held(keys, 'lookRight')) yawRef.current   -= rot
    pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -Math.PI / 3, Math.PI / 3)

    const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)
    lastQuat.current.copy(camera.quaternion)

    const speed = 8 * delta
    const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current))
    const right   = new THREE.Vector3( Math.cos(yawRef.current), 0, -Math.sin(yawRef.current))

    if (held(keys, 'forward')) camera.position.addScaledVector(forward, speed)
    if (held(keys, 'back'))    camera.position.addScaledVector(forward, -speed)
    if (held(keys, 'left'))    camera.position.addScaledVector(right, -speed)
    if (held(keys, 'right'))   camera.position.addScaledVector(right, speed)

    // Lock Y to eye height (terrain follow will be added in 01.4+ with raycasting)
    camera.position.y = 1.75
  })

  return null
}

// ── Main controller ───────────────────────────────────────────────────────────
export function CameraController() {
  const cameraMode = useUIStore((s) => s.cameraMode)

  if (cameraMode === 'walk') return <WalkCamera />
  return <FlyCamera />
}
