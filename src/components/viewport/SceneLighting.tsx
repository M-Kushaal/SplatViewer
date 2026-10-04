import { useUIStore } from '../../store/uiStore'

// A fixed warm afternoon sun (azimuth 220°, elevation 35°).
const SUN = { sunAzimuth: 220, sunElevation: 35 }

function azimuthElevationToDirection(azimuthDeg: number, elevationDeg: number): [number, number, number] {
  const az = (azimuthDeg * Math.PI) / 180
  const el = (elevationDeg * Math.PI) / 180
  const x = Math.sin(az) * Math.cos(el)
  const y = Math.sin(el)
  const z = Math.cos(az) * Math.cos(el)
  return [x * 500, y * 500, z * 500]  // position the light far away
}

export function SceneLighting() {
  const sky = SUN
  const quality = useUIStore((s) => s.quality)
  const illum = useUIStore((s) => s.sceneIllumination)
  const [lx, ly, lz] = azimuthElevationToDirection(sky.sunAzimuth, sky.sunElevation)

  // Night-time dim: intensity scales down below elevation 10°, then the user's
  // illumination slider scales the whole scene.
  const intensity = Math.max(0.1, Math.min(1.4, sky.sunElevation / 40)) * illum

  return (
    <>
      {/* Sky light (blue-ish overhead ambient) */}
      <hemisphereLight
        color="#87ceeb"   // three names the sky colour `color` on HemisphereLight
        groundColor="#4a5c3a"
        intensity={0.28 * illum}
      />

      {/* Sun — directional, casts shadows */}
      <directionalLight
        position={[lx, ly, lz]}
        intensity={intensity * 0.75}
        color="#fff5e0"
        castShadow={quality === 'high'}   // shadows only in High mode — big saving on integrated GPUs
        shadow-mapSize-width={1024}    // 1024 instead of 2048 — 4x cheaper shadow pass
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={2000}
        shadow-camera-left={-300}      // tighter frustum = sharper shadows at lower res
        shadow-camera-right={300}
        shadow-camera-top={300}
        shadow-camera-bottom={-300}
        shadow-bias={-0.0005}
      />

      {/* Soft fill from opposite side (prevents totally black shadows) */}
      <directionalLight
        position={[-lx * 0.3, Math.abs(ly) * 0.5, -lz * 0.3]}
        intensity={intensity * 0.1}
        color="#c0d4e8"
      />
    </>
  )
}
