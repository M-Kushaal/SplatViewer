# Splat rendering quality

What it takes to turn a raw Gaussian-splat viewer into one that looks as good as the trainer / SuperSplat, and
what is left to do. Grid- and UI-specific work is not covered here.

Code: `src/components/viewport/SplatScene.tsx` (rendering), `src/store/splatStore.ts` (settings),
`src/components/ui/SplatImport.tsx` (panel).

Renderer: **Spark** (`@sparkjsdev/spark` 2.3, needs three.js ≥ 0.180). It replaced
`@mkkellogg/gaussian-splats-3d`, which capped colour at SH degree 2 and needed manual re-sort workarounds.

## Done

### Biggest visible wins

| # | Change | Why it matters |
|---|--------|----------------|
| 1 | **View-dependent colour (spherical harmonics) on, all 3 bands.** Spark renders SH degree 3 by default (`maxSh = 3`). | Shine on metal and glass. Degree 0 (mkkellogg's default) is base colour only and makes everything flat grey. This was the single biggest difference. |
| 2 | **Respect the file's orientation.** No forced flip; **Flip** is a live toggle (rotates the mesh 180° about X, no reload). | Some trainers export Y-down (COLMAP), many don't. A forced flip turned the test bottle into a "mushroom". |
| 3 | **Opacity as trained (1.0).** The slider multiplies opacity (`SplatMesh.opacity`). | Boosting makes faint wispy splats solid, so the result looks spiky. |
| 4 | **Full-precision storage** (`extSplats: true`). | Spark's default packs positions and colours into 16/8 bits. Ext encoding avoids quantisation on small objects and in big scenes. |
| 4b | **Sharpness = 2.0** (`SparkRenderer.focalAdjustment`; slider 1–3). | 1.0 is the exact 3DGS projection; 2.0 is what PlayCanvas, and therefore SuperSplat, uses. Each splat is drawn tighter, so fabric weave and edges read noticeably crisper. |
| 5 | **Training-matched blur filter.** Classic 3DGS: `preBlurAmount 0.3, blurAmount 0`. Anti-aliased training (Mip-Splatting / gsplat antialiased): `preBlurAmount 0, blurAmount 0.3`. **AA-trained** toggle. | Rendering with a different filter than training makes splats too thin (holes, sparkle) or too fat (blur). |

### Correctness

| # | Change | Why it matters |
|---|--------|----------------|
| 6 | **Sorting handled by Spark**: worker sort every time the view changes, correct for any parent transform (gizmo) and multiple splat meshes. | Splats are alpha-blended back-to-front, so a stale order gives wrong layering. mkkellogg only re-sorted after 1 m / ~8° camera moves and ignored object moves. |
| 7 | **Redraw on demand**: `SparkRenderer({ onDirty: invalidate })`. | The canvas uses `frameloop="demand"` (0% GPU idle). Without this, a finished sort is never drawn. |
| 8 | **Near plane scaled to the object**: `near = radius × 0.01` (clamped 1 mm…0.1 m). | A fixed 0.1 m near plane slices small objects when you get close. |
| 9 | **Draw order**: SparkRenderer `renderOrder = 10`, after the grid. Solid floor hidden while a splat is open. | Overlays with depth test off paint over splats. Opaque depth-writing geometry hides splats behind/below it. |
| 10 | **No tone mapping on splats** (High mode skips ACES while a splat is open). | Splat colours are display-ready, so ACES washes them out. |

### First impression

| # | Change | Why it matters |
|---|--------|----------------|
| 11 | **Robust framing**: 2nd–98th percentile box per axis; camera fits that box's bounding sphere. | The median splat sits where most splats are (a bottle's mat), so it aims at the floor. Raw min/max is wrecked by floaters. |
| 12 | **Hi-DPI**: render at device pixel ratio (cap 1.5 Low / 2 High). | Splat edges are pixel-sized detail and go soft at 1×. |
| 13 | **Fly speed and scale bar follow the object size.** | A 10 cm object and a 100 m street both navigate sensibly. |

### Clean-up and tuning

| # | Change | Why it matters |
|---|--------|----------------|
| 14 | **Floater removal** (**Floaters off** toggle, non-destructive: sets opacity 0, restores on toggle off). Hides splats that are (a) >10% outside the robust box, (b) isolated: fewer than 6 splats in their 3×3×3 neighbourhood of a 48³ voxel grid, or (c) haze: opacity < 0.15 and size > 2% of the object. | Much of SuperSplat's "cleaner" look is deleted junk. The test bottle: 1,819 of 137,794 hidden, side haze gone, object intact. |
| 15 | **Max splat size** slider (`SparkRenderer.maxPixelRadius`, 16–512 px). | Caps giant smears when the camera is inside or very near a large splat. |

## To do (rough order of value)

1. **Background matched to training** (black / white / transparent picker). Edge halos blend best against the colour
   the splat was trained on.
2. **Exposure / gamma controls** in the splat shader (Spark `recolor` or a custom fragment shader). Not a
   post-process, so the grid is unaffected.
3. **Z-depth sort option** (`sortRadial: false`). Spark defaults to radial sort (more stable when turning). Most
   files are trained with z-depth sort and can look slightly more accurate with it.
4. **Manual clean-up tools**: crop box, then brush / lasso select-and-delete like SuperSplat. Export the cleaned
   file (`.ply` / `.spz`).
5. **Floater tuning UI**: expose the neighbour threshold and haze opacity/size limits. The defaults are tuned on one
   object capture; large outdoor scenes (sparse sky) may need gentler settings.
6. **Level of detail for big scenes** (`lod: true` / `.rad` files, `lodSplatScale`). Keeps multi-million-splat
   scenes fast.
7. **Full-resolution still frames**: lower DPR while moving, full (or supersampled) DPR once the camera stops.
8. **2DGS / 3DGUT files**: `enable2DGS` and the alternative ray-splat evaluation, for files trained that way.
9. **Turn off canvas MSAA when a splat is open.** Spark recommends `antialias: false`; MSAA costs speed and doesn't
   improve splats. The grid currently relies on it, so it needs a grid-side alternative first.
