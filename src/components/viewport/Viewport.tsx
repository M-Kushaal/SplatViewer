import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import { Ground } from './Ground'
import { StudioBackground } from './StudioBackground'
import { SceneLighting } from './SceneLighting'
import { CameraController } from './CameraController'
import { PostProcessing } from './PostProcessing'
import { ScaleTracker } from './ScaleTracker'
import { RenderOnDemand } from './RenderOnDemand'
import { SplatScene } from './SplatScene'
import { useUIStore } from '../../store/uiStore'
import { useSplatStore } from '../../store/splatStore'

export function Viewport() {
  const quality = useUIStore((s) => s.quality)
  const illum = useUIStore((s) => s.sceneIllumination)
  const hasSplat = useSplatStore((s) => s.file !== null)
  const showGrid = useSplatStore((s) => s.showGrid)

  // Fog colour tracks the backdrop brightness so the horizon never seams.
  const fogColor = useMemo(() => {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * illum)))
    return (clamp(0x13) << 16) | (clamp(0x15) << 8) | clamp(0x1a)
  }, [illum])

  // Render at the display's TRUE pixel ratio (capped) so edges stay crisp on
  // hi-DPI screens. FIXED — no auto-downgrade. The old PerformanceMonitor
  // permanently ratcheted this down whenever FPS dipped and never restored it,
  // so the scene slowly went blurry. With frameloop="demand" the GPU is idle
  // unless you're interacting, so it isn't pegged and doesn't need throttling.
  const dprMax = quality === 'low' ? 1.5 : 2

  return (
    <Canvas
      // Premium 3/4 framing, lower FOV for a calmer, more cinematic perspective.
      // Kept close so the build origin sits in the crisp centre of the grid.
      camera={{ position: [55, 42, 55], fov: 50, near: 0.1, far: 20000 }}
      shadows                                  // shadow system enabled; lights opt in per-quality
      frameloop="demand"                       // only redraw on input/changes → 0% GPU when idle
      gl={{
        antialias: true,                       // hardware MSAA — cheap, stops grid lines shimmering
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,           // needed for screenshot export later
      }}
      dpr={[1, dprMax]}                        // use device ratio, clamped to [1, dprMax]
      onCreated={({ camera }) => camera.lookAt(0, 0, 0)}   // frame the scene on load
      style={{ width: '100%', height: '100%' }}
    >
      {/* Fog tuned to the backdrop's horizon colour — the ground dissolves into
          the background instead of ending in a hard line. Eased density so the
          grid stays readable from high up while the far horizon still melts. */}
      <fogExp2 attach="fog" args={[fogColor, 0.0015]} />

      {/* Pumps frames on input/store-changes so on-demand rendering stays smooth. */}
      <RenderOnDemand />

      <Suspense fallback={null}>
        <StudioBackground />
        <SceneLighting />
        <Ground solid={!hasSplat} grid={!hasSplat || showGrid} />
        <SplatScene />
        <CameraController />
        <ScaleTracker />
        {/* Post-processing is skipped entirely in Low mode */}
        {quality === 'high' && <PostProcessing />}
      </Suspense>
    </Canvas>
  )
}
