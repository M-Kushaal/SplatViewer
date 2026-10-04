import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { SparkRenderer, SplatMesh, SplatFileType } from '@sparkjsdev/spark'
import type { ExtSplats } from '@sparkjsdev/spark'
import type { SplatFormat } from '../../store/splatStore'
import { useSplatStore } from '../../store/splatStore'
import { useUIStore } from '../../store/uiStore'
import { useViewStore } from '../../store/viewStore'
import { RAD2DEG } from '../../math'

const FILE_TYPES: Record<SplatFormat, SplatFileType> = {
  ply: SplatFileType.PLY,
  splat: SplatFileType.SPLAT,
  ksplat: SplatFileType.KSPLAT,
  spz: SplatFileType.SPZ,
}

// 180° about X: turns Y-down trainer output (COLMAP convention) right side up.
const FLIP_X = new THREE.Quaternion(1, 0, 0, 0)
const NO_FLIP = new THREE.Quaternion()
const DEFAULT_NEAR = 0.1   // matches the Canvas camera in Viewport

// Classic 3DGS adds a 0.3 px² blur when training; anti-aliased training (Mip-
// Splatting, gsplat "antialiased") moves it into an opacity-compensated filter.
// Rendering with the same filter the file was trained with is what keeps edges
// as sharp as in the trainer.
const BLUR_CLASSIC = { preBlurAmount: 0.3, blurAmount: 0 }
const BLUR_AA      = { preBlurAmount: 0,   blurAmount: 0.3 }

// ─────────────────────────────────────────────────────────────────────────────
// Renders the imported Gaussian splat with Spark (@sparkjsdev/spark).
// Quality notes and the roadmap live in docs/SPLAT_RENDERING.md.
//
// • SparkRenderer sorts splats in a worker and calls onDirty when a new order
//   (or anything else) needs a redraw — wired to invalidate() so the
//   frameloop="demand" canvas still idles at 0% GPU.
// • extSplats: full-precision storage (no 16-bit quantisation of positions /
//   colours), and all 3 bands of view-dependent colour (spherical harmonics).
// • Move / rotate: the mesh sits in `inner`, offset by -centre inside `pivot`,
//   so the gizmo on `pivot` turns the splat about its own centre.
// ─────────────────────────────────────────────────────────────────────────────
export function SplatScene() {
  const file = useSplatStore((s) => s.file)
  const flipped = useSplatStore((s) => s.flipped)
  const ready = useSplatStore((s) => s.status === 'ready')
  const gizmoMode = useSplatStore((s) => s.gizmoMode)
  const transformKey = useSplatStore((s) => s.transformKey)
  const frameKey = useSplatStore((s) => s.frameKey)
  const opacity = useSplatStore((s) => s.opacity)
  const maxSplatPx = useSplatStore((s) => s.maxSplatPx)
  const aaTrained = useSplatStore((s) => s.aaTrained)
  const sharpness = useSplatStore((s) => s.sharpness)
  const removeFloaters = useSplatStore((s) => s.removeFloaters)
  const cameraMode = useUIStore((s) => s.cameraMode)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const pivotRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Group>(null)
  const centerRef = useRef(new THREE.Vector3())
  const [mesh, setMesh] = useState<SplatMesh | null>(null)
  const sparkRef = useRef<SparkRenderer | null>(null)

  // One SparkRenderer for the canvas; it draws every SplatMesh in the scene.
  useEffect(() => {
    const spark = new SparkRenderer({ renderer: gl, onDirty: () => invalidate() })
    spark.renderOrder = 10   // after the grid (renderOrder 2, no depth test), so the grid doesn't paint over splats
    scene.add(spark)
    sparkRef.current = spark
    return () => {
      scene.remove(spark)
      sparkRef.current = null
    }
  }, [gl, scene, invalidate])

  // Render-quality settings.
  useEffect(() => {
    const spark = sparkRef.current
    if (!spark) return
    spark.maxPixelRadius = maxSplatPx
    spark.focalAdjustment = sharpness
    Object.assign(spark, aaTrained ? BLUR_AA : BLUR_CLASSIC)
    invalidate()
  }, [maxSplatPx, aaTrained, sharpness, invalidate])

  // Load the file.
  useEffect(() => {
    const inner = innerRef.current
    const pivot = pivotRef.current
    if (!file || !inner || !pivot) return
    const { setProgress, setReady, setError } = useSplatStore.getState()

    let cancelled = false
    resetPivot(pivot, inner, new THREE.Vector3())
    const m = new SplatMesh({
      url: file.url,                         // blob: URL of the local file
      fileType: FILE_TYPES[file.format],     // a blob URL has no extension to sniff
      fileName: file.name,
      extSplats: true,
      onProgress: (e) => {
        if (!cancelled && e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
      },
    })
    inner.add(m)

    m.initialized
      .then(() => {
        if (cancelled) return
        const count = m.extSplats?.numSplats ?? 0
        if (count === 0) {
          setError(`"${file.name}" has no splats in it.`)
          return
        }
        m.quaternion.copy(useSplatStore.getState().flipped ? FLIP_X : NO_FLIP)
        const { center, radius } = layout(m, pivot, inner, centerRef.current)
        setReady(count, radius, [center.x, center.y, center.z])
        // Small objects (a few cm) would be clipped by the default 0.1 m near plane up close.
        camera.near = THREE.MathUtils.clamp(radius * 0.01, 0.001, DEFAULT_NEAR)
        camera.updateProjectionMatrix()
        frameCamera(center, radius)
        setMesh(m)
        invalidate()
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(`Couldn't read "${file.name}": ${msg}`)
      })

    return () => {
      cancelled = true
      setMesh(null)
      inner.remove(m)
      m.dispose()
      camera.near = DEFAULT_NEAR
      camera.updateProjectionMatrix()
      invalidate()
    }
  }, [file, invalidate, camera])

  // Flip: applied live, then re-centre the pivot and re-frame.
  useEffect(() => {
    const pivot = pivotRef.current, inner = innerRef.current
    if (!mesh || !pivot || !inner) return
    const q = flipped ? FLIP_X : NO_FLIP
    if (mesh.quaternion.equals(q)) return
    mesh.quaternion.copy(q)
    const { center, radius } = layout(mesh, pivot, inner, centerRef.current)
    useSplatStore.getState().setFocus([center.x, center.y, center.z])
    frameCamera(center, radius)
    invalidate()
  }, [flipped, mesh, invalidate])

  useEffect(() => {
    if (!mesh) return
    mesh.opacity = opacity
    invalidate()
  }, [mesh, opacity, invalidate])

  // Floater cleanup: hide (opacity 0) instead of delete, so it can be undone.
  useEffect(() => {
    const ext = mesh?.extSplats
    if (!mesh || !ext) return
    const hidden = removeFloaters ? hideFloaters(ext) : null
    useSplatStore.getState().setFloatersHidden(hidden ? hidden.indices.length : 0)
    commitSplatEdits(mesh, ext)
    invalidate()
    return () => {
      if (!hidden) return
      restoreOpacity(ext, hidden)
      commitSplatEdits(mesh, ext)
      invalidate()
    }
  }, [mesh, removeFloaters, invalidate])

  // "Frame" in the panel: fly back to the splat wherever the gizmo has put it.
  useEffect(() => {
    const pivot = pivotRef.current
    const r = useSplatStore.getState().radius
    if (!frameKey || !pivot || r <= 0) return
    frameCamera(pivot.getWorldPosition(new THREE.Vector3()), r)
  }, [frameKey])

  // "Reset" in the panel: back to where the file put it.
  useEffect(() => {
    if (!transformKey || !pivotRef.current || !innerRef.current) return
    resetPivot(pivotRef.current, innerRef.current, centerRef.current)
    syncFocus(pivotRef.current)
    invalidate()
  }, [transformKey, invalidate])

  const { setGizmoDragging } = useSplatStore.getState()
  const showGizmo = ready && gizmoMode !== 'off' && cameraMode === 'fly'

  // If the gizmo disappears mid-drag (e.g. G pressed), it never sends mouseUp —
  // clear the flag or mouse-look would stay disabled.
  useEffect(() => { if (!showGizmo) setGizmoDragging(false) }, [showGizmo, setGizmoDragging])

  return (
    <>
      <group ref={pivotRef}>
        <group ref={innerRef} />
      </group>
      {/* Walk mode clicks to lock the mouse, which fights the gizmo — Fly only. */}
      {showGizmo && (
        <TransformControls
          object={pivotRef as MutableRefObject<THREE.Object3D>}
          mode={gizmoMode === 'rotate' ? 'rotate' : 'translate'}
          onMouseDown={() => setGizmoDragging(true)}
          onMouseUp={() => { setGizmoDragging(false); syncFocus(pivotRef.current) }}
        />
      )}
    </>
  )
}

// Measure the splat (with its current flip) and put the pivot at its centre.
function layout(mesh: SplatMesh, pivot: THREE.Object3D, inner: THREE.Object3D, centerOut: THREE.Vector3) {
  const { center, radius } = measure(mesh.extSplats!, mesh.quaternion)
  centerOut.copy(center)
  resetPivot(pivot, inner, center)
  return { center, radius }
}

// The scale bar measures at the splat's centre (see ScaleTracker).
function syncFocus(pivot: THREE.Object3D | null) {
  if (!pivot) return
  const p = pivot.getWorldPosition(new THREE.Vector3())
  useSplatStore.getState().setFocus([p.x, p.y, p.z])
}

function resetPivot(pivot: THREE.Object3D, inner: THREE.Object3D, center: THREE.Vector3) {
  pivot.position.copy(center)
  pivot.quaternion.identity()
  pivot.scale.setScalar(1)
  inner.position.copy(center).negate()
}

// Robust bounds: the 2nd–98th percentile box on each axis, so stray "floater"
// splats don't wreck the framing. Centre = box middle (not the median splat —
// a bottle on a mat has most splats in the mat, which would aim at the floor).
function robustBox(ext: ExtSplats, rotate?: THREE.Quaternion) {
  const n = ext.numSplats
  const stride = Math.max(1, Math.floor(n / 50000))
  const xs: number[] = [], ys: number[] = [], zs: number[] = []
  for (let i = 0; i < n; i += stride) {
    const c = ext.getSplat(i).center
    if (rotate) c.applyQuaternion(rotate)
    xs.push(c.x); ys.push(c.y); zs.push(c.z)
  }
  const range = (a: number[]) => {
    a.sort((p, q) => p - q)
    return [a[Math.floor(a.length * 0.02)], a[Math.floor(a.length * 0.98)]]
  }
  const [x0, x1] = range(xs), [y0, y1] = range(ys), [z0, z1] = range(zs)
  return new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1))
}

function measure(ext: ExtSplats, rotate: THREE.Quaternion) {
  const box = robustBox(ext, rotate)
  const center = box.getCenter(new THREE.Vector3())
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.005)
  return { center, radius }
}

// Floaters, three kinds:
//  1. far outside the object's robust box (stray specks);
//  2. isolated — almost no other splats nearby (wisps and specks inside the box);
//  3. haze — faint AND large (the smoky blobs trainers leave around an object).
// Density uses a 48³ voxel grid over the box; a splat is isolated when its
// 3×3×3 neighbourhood holds fewer than MIN_NEIGHBOURS splats.
const GRID = 48
const MIN_NEIGHBOURS = 6
function hideFloaters(ext: ExtSplats) {
  const n = ext.numSplats
  const box = robustBox(ext)
  const size = box.getSize(new THREE.Vector3())
  const diag = size.length()
  const keep = box.clone().expandByScalar(diag * 0.1)
  const kSize = keep.getSize(new THREE.Vector3())
  const cell = (c: THREE.Vector3) => {
    const x = Math.floor(((c.x - keep.min.x) / kSize.x) * GRID)
    const y = Math.floor(((c.y - keep.min.y) / kSize.y) * GRID)
    const z = Math.floor(((c.z - keep.min.z) / kSize.z) * GRID)
    return x < 0 || y < 0 || z < 0 || x >= GRID || y >= GRID || z >= GRID ? -1 : (x * GRID + y) * GRID + z
  }

  // Pass 1: decode once, bin centres.
  const counts = new Uint32Array(GRID * GRID * GRID)
  const cells = new Int32Array(n)
  for (let i = 0; i < n; i++) {
    const c = cell(ext.getSplat(i).center)
    cells[i] = c
    if (c >= 0) counts[c]++
  }
  const neighbours = (c: number) => {
    const x = Math.floor(c / (GRID * GRID)), y = Math.floor(c / GRID) % GRID, z = c % GRID
    let total = 0
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const X = x + dx, Y = y + dy, Z = z + dz
      if (X >= 0 && Y >= 0 && Z >= 0 && X < GRID && Y < GRID && Z < GRID) total += counts[(X * GRID + Y) * GRID + Z]
    }
    return total
  }
  const dense = new Map<number, boolean>()

  // Pass 2: hide.
  const indices: number[] = []
  const opacities: number[] = []
  for (let i = 0; i < n; i++) {
    const s = ext.getSplat(i)
    if (s.opacity === 0) continue
    const c = cells[i]
    let floater = c < 0
    if (!floater) {
      let d = dense.get(c)
      if (d === undefined) { d = neighbours(c) >= MIN_NEIGHBOURS; dense.set(c, d) }
      floater = !d
    }
    if (!floater) floater = s.opacity < 0.15 && Math.max(s.scales.x, s.scales.y, s.scales.z) > diag * 0.02
    if (!floater) continue
    indices.push(i)
    opacities.push(s.opacity)
    ext.setSplat(i, s.center, s.scales, s.quaternion, 0, s.color)
  }
  return { indices, opacities }
}

function restoreOpacity(ext: ExtSplats, hidden: { indices: number[]; opacities: number[] }) {
  hidden.indices.forEach((i, k) => {
    const s = ext.getSplat(i)
    ext.setSplat(i, s.center, s.scales, s.quaternion, hidden.opacities[k], s.color)
  })
}

// setSplat() edits the CPU arrays; the GPU textures share that buffer, so flag
// them for re-upload and bump the mesh version so Spark regenerates its splats.
function commitSplatEdits(mesh: SplatMesh, ext: ExtSplats) {
  for (const t of ext.textures) t.needsUpdate = true
  mesh.updateVersion()
}

// Switch to Fly and back off at a 3/4 angle until the whole splat fits the view.
function frameCamera(center: THREE.Vector3, radius: number) {
  useUIStore.getState().setCameraMode('fly')
  const dist = radius / Math.sin((50 / 2) * (Math.PI / 180))   // fov 50 (Viewport): bounding sphere just fits
  const pos = center.clone().addScaledVector(new THREE.Vector3(1, 0.6, 1).normalize(), dist)
  const cam = new THREE.PerspectiveCamera()
  cam.position.copy(pos)
  cam.lookAt(center)
  const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ')
  useViewStore.getState().applyPose([pos.x, pos.y, pos.z], [e.x * RAD2DEG, e.y * RAD2DEG, 0])
}
