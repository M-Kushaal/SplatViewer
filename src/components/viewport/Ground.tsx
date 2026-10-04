import { InfiniteGrid } from './InfiniteGrid'

// `solid` = the floor plane; `grid` = the line grid. With a splat open the
// floor is dropped (it would hide everything below y=0) and the grid is optional.
export function Ground({ solid = true, grid = true }: { solid?: boolean; grid?: boolean }) {
  return (
    <>
      {/* Solid ground: a dark, low-saturation surface reads as premium and lets the grid pop. */}
      {solid && <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[12000, 12000]} />
        <meshStandardMaterial color="#262b25" roughness={1} metalness={0} />
      </mesh>}

      {/* Adaptive LOD grid: coarse from high up, fine when close, always crisp. */}
      {grid && <InfiniteGrid />}
    </>
  )
}
