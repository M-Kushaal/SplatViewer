import * as THREE from 'three'
import { useEffect, useMemo } from 'react'
import { useUIStore } from '../../store/uiStore'

// A smooth vertical gradient backdrop — the neutral "studio" look used by
// premium 3D editors (Spline / Womp / Blender). Its brightness follows the
// illumination slider so the whole setting visibly lightens / darkens.
export function StudioBackground() {
  const illum = useUIStore((s) => s.sceneIllumination)

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor:    { value: new THREE.Color('#30343d') },  // soft cool charcoal up high
        midColor:    { value: new THREE.Color('#212430') },
        bottomColor: { value: new THREE.Color('#13151a') },  // near-black at horizon (matches fog)
        uBrightness: { value: 0.2 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3  topColor;
        uniform vec3  midColor;
        uniform vec3  bottomColor;
        uniform float uBrightness;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;        // -1 (down) .. 1 (up)
          float t = clamp(h * 0.5 + 0.5, 0.0, 1.0);     // 0 .. 1
          vec3 lower = mix(bottomColor, midColor, smoothstep(0.0, 0.5, t));
          vec3 col   = mix(lower, topColor, smoothstep(0.5, 1.0, t));
          gl_FragColor = vec4(col * uBrightness, 1.0);
        }
      `,
    })
  }, [])

  // Illumination scales the backdrop brightness (0.7 slider ≈ current look).
  useEffect(() => {
    material.uniforms.uBrightness.value = illum
  }, [material, illum])

  return (
    <mesh material={material} frustumCulled={false} renderOrder={-1}>
      <sphereGeometry args={[6000, 32, 16]} />
    </mesh>
  )
}
