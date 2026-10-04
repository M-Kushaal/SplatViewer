import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useUIStore } from '../../store/uiStore'
import { useViewStore } from '../../store/viewStore'
import { useSplatStore } from '../../store/splatStore'

// ─────────────────────────────────────────────────────────────────────────────
// On-demand render pump.
//
// The Canvas runs with frameloop="demand", so the scene only redraws when
// something asks for a frame. That means 0% GPU while idle — essential on
// integrated/CPU graphics. This component is the single place that asks:
//
//   • once on any input (key / pointer / wheel), and CONTINUOUSLY while keys are
//     held or the pointer is dragging (or pointer-locked in Walk) so camera
//     navigation stays smooth;
//   • whenever any store changes — sliders and
//     manually-entered / Home camera poses.
//
// It deliberately does NOT touch the camera controllers: their useFrame runs on
// whatever frames we pump here, so movement math is unchanged.
// ─────────────────────────────────────────────────────────────────────────────
export function RenderOnDemand() {
  const invalidate = useThree((s) => s.invalidate)
  const keysHeld = useRef<Set<string>>(new Set())
  const dragging = useRef(false)
  const lastInput = useRef(0)

  useEffect(() => {
    const bump = () => {
      lastInput.current = performance.now()
      invalidate()
    }

    const onKeyDown = (e: KeyboardEvent) => { keysHeld.current.add(e.code); bump() }
    const onKeyUp   = (e: KeyboardEvent) => { keysHeld.current.delete(e.code); bump() }
    const onPointerDown = () => { dragging.current = true; bump() }
    const onPointerUp   = () => { dragging.current = false; bump() }
    // Render on move while drag-looking (Fly) or pointer-locked (Walk).
    const onPointerMove = () => { if (dragging.current || document.pointerLockElement) bump() }
    const onWheel = () => bump()
    // Safety: if focus leaves the window a keyup can be missed — clear held keys
    // so we don't render forever.
    const onBlur = () => { keysHeld.current.clear(); dragging.current = false }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('wheel', onWheel)
    window.addEventListener('blur', onBlur)

    // Any store change → we need at least one frame to reflect it.
    const unsubUI    = useUIStore.subscribe(() => invalidate())
    const unsubView  = useViewStore.subscribe(() => invalidate())
    const unsubSplat = useSplatStore.subscribe(() => invalidate())

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onBlur)
      unsubUI()
      unsubView()
      unsubSplat()
    }
  }, [invalidate])

  // While input is ongoing, keep requesting the next frame. The 200ms tail
  // covers gaps between OS key-repeat events and renders the final resting state.
  useFrame(() => {
    if (
      keysHeld.current.size > 0 ||
      dragging.current ||
      performance.now() - lastInput.current < 200
    ) {
      invalidate()
    }
  })

  return null
}
