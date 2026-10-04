import { Viewport } from './components/viewport/Viewport'
import { CameraToggle } from './components/ui/CameraToggle'
import { TopRightMenus } from './components/ui/TopRightMenus'
import { ScaleBar } from './components/ui/ScaleBar'
import { AxisGizmo } from './components/ui/AxisGizmo'
import { CameraHud } from './components/ui/CameraHud'
import { HotkeyHandler } from './components/ui/HotkeyHandler'
import { WalkModeHint } from './components/ui/WalkModeHint'
import { SplatPanel } from './components/ui/SplatImport'

function App() {
  return (
    // Full-screen layout. Relative so overlaid panels can be positioned absolutely.
    <div className="relative w-full h-full">

      {/* ── 3D canvas fills everything ── */}
      <Viewport />

      {/* ── Floating UI overlaid on canvas ── */}

      {/* Top bar: camera toggle */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        <CameraToggle />
      </div>

      {/* Left, under the camera box: open / drop a splat, gizmo, view toggles */}
      <SplatPanel />

      {/* Top-right dropdowns: Grid settings (quality + sliders) and Info (controls) */}
      <TopRightMenus />

      {/* Walk mode instruction hint */}
      <WalkModeHint />

      {/* Map-style scale bar — shows what the grid spacing means */}
      <ScaleBar />

      {/* DOM axis gizmo — always visible, even in High quality mode */}
      <AxisGizmo />

      {/* Live camera position/angle readout + manual entry + return-to-origin */}
      <CameraHud />

      {/* Global keyboard shortcuts (no DOM output) */}
      <HotkeyHandler />

      {/* Dev: tiny build label */}
      {import.meta.env.DEV && (
        <div className="absolute bottom-2 right-3 text-white/20 text-[10px] pointer-events-none select-none">
          Splat Viewer
        </div>
      )}
    </div>
  )
}

export default App
