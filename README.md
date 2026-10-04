# Splat Viewer

A standalone infinite 3D grid viewer: a dark studio backdrop and an adaptive, analytic grid. Every line stays a crisp
hairline at any distance or angle, and finer cells fade in as you get closer. Live sliders let you tune the look.

Built with Vite + React + TypeScript + three.js (react-three-fiber).

## Run it

Needs [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

`npm run build` typechecks and builds a static site into `dist/`. You can host that folder anywhere.

## Viewing splats

Click **Open splat** (left, under the Camera box) or drop a `.ply`, `.splat`, `.ksplat` or `.spz` file anywhere on
the page. The file is read locally and never uploaded. The camera frames the splat, and Fly speed scales to its size.

- **Gizmo**: Move shows coloured arrows, Rotate shows coloured rings (Fly mode). **Reset** undoes them,
  **Frame** flies the camera back to the splat.
- **Quality**: Opacity (1 = as trained), Sharpness (2 = SuperSplat look), Max splat size, **Floaters off** (hides stray specks and haze; turn off
  to undo), **AA-trained** (for files trained with anti-aliasing / Mip-Splatting).
- **Flip**: turns the splat upside down, for files that load that way.

Rendering uses [Spark](https://sparkjs.dev). What was done for quality, and what's next, is in
[docs/SPLAT_RENDERING.md](docs/SPLAT_RENDERING.md).
- **Grid**: show or hide the ground grid (2 cm / 10 cm / 20 cm cells, plus 2 m and 20 m majors). The solid floor is hidden while a splat is open.

## Settings box (top-right)

One box with three sections: **Grid settings**, **Change keys** and **Info**.

### Grid settings

**Quality**: Low (default, safe on integrated GPUs) or High (shadows + tone mapping).
**Reset to defaults** puts every slider back to the original look.

| Slider    | What it does                                                        |
|-----------|---------------------------------------------------------------------|
| Light     | Brightness of the backdrop and the scene lighting                   |
| Grid      | Line intensity: below 1 fades the lines, above 1 brightens them     |
| Thickness | On-screen line width (0.6 = fine hairline)                          |
| Axis glow | Brightness of the X/Z origin axis lines                             |

## Controls (defaults; every key can be changed)

- **Fly** (F): drag the mouse to look. I/J/K/L to move, U/N for up/down, W/X and A/D to look, Q/E to roll,
  hold Shift to move faster.
- **Ground Walk** (G): first person at eye height. I/J/K/L to walk, W/X and A/D to look, or click to lock the
  mouse and look with it (Esc releases).
- **Camera panel** (top-left): type a position or angle, or press Origin to reset.
- **Change keys** opens an on-screen keyboard with the keys in use highlighted. Pick an action (or a highlighted
  key), then press the new key. A key that's already taken swaps over. Choices are saved in your browser,
  and "Reset keys to default" restores the layout above.
- **Info** lists every control with your current keys.

The scene only redraws while you interact, so an idle tab uses ~0% GPU.

## Where the grid lives

- `src/components/viewport/InfiniteGrid.tsx`: the grid shader (line colours, cell sizes, fades)
- `src/components/viewport/StudioBackground.tsx`: the gradient backdrop
- `src/components/ui/GridSettings.tsx`: the quality toggle, sliders and reset
- `src/store/uiStore.ts`: slider defaults
- `src/store/keyStore.ts`: default key bindings
