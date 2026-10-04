import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useUIStore } from '../../store/uiStore'

// ─────────────────────────────────────────────────────────────────────────────
// Adaptive infinite grid — ANALYTIC (no texture).
//
// Every line's width is derived from screen-space derivatives, so a
// line is a constant ~1px whether it's a 1 m cell line or a 10 km major, at any
// viewing angle. That's the whole point: the old texture-based grid made coarse
// lines physically huge in world space (the 10 km line was ~68 m wide), and the
// only place such a line fell on screen was x=0 / z=0 — which is why the origin
// bloomed into a fat white cross. Analytic lines can't do that.
//
//   • depthTest OFF   → no z-fighting with the ground plane.
//   • Fine cells fade out once they shrink below ~1px → no shimmer, smooth LOD.
//   • Plane follows the camera & floats the origin → float precision far out.
// ─────────────────────────────────────────────────────────────────────────────

const SNAP = 100000

const vertexShader = /* glsl */ `
  uniform vec2 uOffset;
  varying vec2 vGrid;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vGrid = wp.xz - uOffset;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vGrid;

  uniform vec2  uOffset;
  uniform vec2  uCamGrid;
  uniform vec3  uMinorColor;
  uniform vec3  uMajorColor;
  uniform float uOpacity;
  uniform float uFar;
  uniform float uAxisGlow;

  // Anti-aliased coverage of the grid lines for a given cell size.
  // uLineWidth is the requested on-screen line half-width in device pixels.
  uniform float uLineWidth;

  // Never draw a line thinner than MIN_HALF px: a sub-pixel line only lights the
  // pixels whose centres it happens to cross, so it breaks into dashes as the
  // camera moves. Thinner requests are drawn at MIN_HALF and dimmed instead
  // ("phone-wire" AA), which keeps every line continuous.
  const float MIN_HALF = 0.75;

  // Screen-space size of one unit of v, per axis. Unlike fwidth (|dx|+|dy|) this
  // isn't inflated ~1.4x on diagonals, so line widths stay even at any angle.
  vec2 unitsPerPx(vec2 v) {
    return vec2(length(vec2(dFdx(v.x), dFdy(v.x))), length(vec2(dFdx(v.y), dFdy(v.y))));
  }

  // Coverage of a line at distPx pixels away, requested half-width w.
  float lineCov(float distPx, float w) {
    float drawW = max(w, MIN_HALF);
    return (1.0 - smoothstep(drawW - 0.5, drawW + 0.5, distPx)) * (w / drawW);
  }

  float cov(vec2 p, float cell) {
    vec2 c    = p / cell;
    vec2 d    = max(unitsPerPx(c), vec2(1e-6));                  // cells per pixel
    vec2 dist = abs(fract(c - 0.5) - 0.5) / d;                   // px to nearest line
    float w   = max(uLineWidth, 0.05);
    // Fade each line direction out while its lines are still 8 -> 4 px apart
    // (denser lines moire). Per direction, so a grazing view that crowds one
    // set doesn't erase the other.
    vec2 fade = 1.0 - smoothstep(vec2(0.125), vec2(0.25), d);
    return max(lineCov(dist.x, w) * fade.x, lineCov(dist.y, w) * fade.y);
  }

  void main() {
    // Multi-scale: 2 cm / 10 cm / 20 cm cells, plus 2 m and 20 m majors so the
    // grid still reads from high up. Coarsest present line wins the colour.
    float f01  = cov(vGrid, 0.02);
    float f05  = cov(vGrid, 0.1);
    float f1   = cov(vGrid, 0.2);
    float f10  = cov(vGrid, 2.0);
    float f100 = cov(vGrid, 20.0);

    float a = f01 * 0.35;  float c = 0.0;
    if (f05  * 0.5 > a) { a = f05  * 0.5; c = 0.2;  }
    if (f1   * 0.7 > a) { a = f1   * 0.7; c = 0.45; }
    if (f10  * 0.9 > a) { a = f10  * 0.9; c = 0.75; }
    if (f100 * 1.0 > a) { a = f100 * 1.0; c = 1.0;  }

    vec3  col   = mix(uMinorColor, uMajorColor, c);
    float alpha = a;

    // ── Origin world axes: a single thin line at x=0 (Z axis) and z=0 (X axis),
    //    brightness = the glow slider. One pixel wide, no halo. ──
    vec2  world = vGrid + uOffset;
    vec2  dw    = max(unitsPerPx(world), vec2(1e-6));
    float lw    = max(uLineWidth, 0.05);
    float ax    = lineCov(abs(world.y) / dw.y, lw);   // X axis (z=0)
    float az    = lineCov(abs(world.x) / dw.x, lw);   // Z axis (x=0)
    const vec3 AXIS_COL = vec3(0.93, 0.96, 1.00);
    float axisInt = clamp(max(ax, az) * uAxisGlow, 0.0, 1.0);

    // Grid-intensity slider: 0..1 fades the lines, 1..2 brightens the colour.
    col   *= (1.0 + max(uOpacity - 1.0, 0.0));
    alpha *= min(uOpacity, 1.0);
    col    = mix(col, AXIS_COL, axisInt);
    alpha  = max(alpha, axisInt);

    // Fade out toward the far edge of the patch (centred on the focus point).
    float dist = length(vGrid - uCamGrid);
    alpha *= 1.0 - smoothstep(uFar * 0.7, uFar, dist);

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`

// Scratch vectors reused each frame (no per-frame allocation).
const _dir = new THREE.Vector3()

export function InfiniteGrid() {
  const meshRef = useRef<THREE.Mesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const gridIntensity = useUIStore((s) => s.gridIntensity)
  const axisGlow = useUIStore((s) => s.axisGlow)
  const lineWidth = useUIStore((s) => s.gridLineWidth)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,                        // ← kills z-fighting flicker
      side: THREE.DoubleSide,
      extensions: { derivatives: true } as unknown as THREE.ShaderMaterialParameters['extensions'],
      uniforms: {
        uOffset:     { value: new THREE.Vector2() },
        uCamGrid:    { value: new THREE.Vector2() },
        uMinorColor: { value: new THREE.Color('#9298a2') }, // darker grey cell lines
        uMajorColor: { value: new THREE.Color('#cfd4db') }, // soft grey major lines
        uOpacity:    { value: 2 },
        uFar:        { value: 2000 },
        uAxisGlow:   { value: 0.5 },
        uLineWidth:  { value: 0.6 },   // fine hairline; lower = thinner
      },
      vertexShader,
      fragmentShader,
    })
  }, [])

  // Live slider control of grid-line opacity, thickness and axis-glow strength.
  useEffect(() => {
    material.uniforms.uOpacity.value = gridIntensity
    material.uniforms.uAxisGlow.value = axisGlow
    material.uniforms.uLineWidth.value = lineWidth
    invalidate()   // frameloop="demand": request a redraw so slider moves show
  }, [material, gridIntensity, axisGlow, lineWidth, invalidate])

  useFrame(({ camera }) => {
    // Anchor the grid to the ground point the camera is LOOKING at (the centre
    // of the view), so detail refines wherever the user is focused.
    camera.getWorldDirection(_dir)
    let fx = camera.position.x
    let fz = camera.position.z
    let focusDist = Math.max(0.05, Math.abs(camera.position.y))

    if (Math.abs(_dir.y) > 1e-3) {
      const t = -camera.position.y / _dir.y     // ray → ground plane (y=0)
      if (t > 0 && t < 1e6) {
        fx = camera.position.x + _dir.x * t
        fz = camera.position.z + _dir.z * t
        focusDist = camera.position.distanceTo(
          _dir.multiplyScalar(t).add(camera.position),
        )
      }
    }

    // Plane scales with how far you are from the focus point → LOD "mode"
    // is driven by your distance to where you're looking. Coords stay small.
    // The floor (30 m) must stay small too: grid coords are interpolated across
    // the whole quad, and a km-wide quad loses ~0.3 mm of precision — a full
    // pixel when you're inspecting a small object up close, so lines break up.
    const size = THREE.MathUtils.clamp(focusDist * 45, 30, 400000)

    const offX = Math.round(fx / SNAP) * SNAP
    const offZ = Math.round(fz / SNAP) * SNAP

    const u = material.uniforms
    ;(u.uOffset.value as THREE.Vector2).set(offX, offZ)
    ;(u.uCamGrid.value as THREE.Vector2).set(fx - offX, fz - offZ)  // fade centred on focus
    u.uFar.value = size * 0.5

    if (meshRef.current) {
      meshRef.current.position.set(fx, 0.01, fz)                     // patch centred on focus
      meshRef.current.scale.set(size, size, 1)
    }
  })

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      renderOrder={2}
      material={material}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
