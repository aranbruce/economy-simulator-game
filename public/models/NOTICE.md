# 3D model assets

- `boats/boat.glb` — trade-route marker. A real Kenney-style CC0 asset (its
  internal mesh node is named `cargo-container-a` — a shipping-container
  prop, not a boat hull, used deliberately here since it fits the trade
  theme). Its external texture lives at `boats/Textures/colormap.png`,
  referenced from the glTF material by that relative path — keep the
  `Textures/` subfolder alongside the `.glb` if this file is swapped again,
  or the texture will silently fail to resolve (loader falls back to an
  untextured material rather than erroring).

Capital-city markers are **not** a 3D asset — they're an SVG icon
(`public/icons/capital-marker.svg`, a star in a circle) loaded once and
drawn onto the 2D canvas via `drawImage()` in `drawCapitalMarker()`,
`components/map2d/WorldMap.tsx`. Two 3D approaches (a single detailed
Sketchfab scene, then a composed Kenney building cluster) were tried and
dropped — style mismatch and, for the first, a CC-BY attribution
requirement this SVG doesn't carry.

## Orienting a new model

`components/map3d/Map3DOverlay.tsx`'s camera looks straight down world -Z
with no tilt. `components/map3d/models.ts`'s `AXIS_CORRECTIONS` holds a
fixed per-model-key correction quaternion, applied once at instantiation.
`boat` needs its "forward/length" axis along local X (the per-route heading
rotation in the overlay rotates around Z assuming that) *and* its
"up/height" axis along local Z (toward the camera, where it's
invisible/foreshortened — correct for a top-down view of a hull). Kenney-
style assets are typically Y-up with -Z forward, so this remaps
length(Z)->X, width(X)->Y, height(Y)->Z. Add an entry for any future 3D
model that needs the same treatment; a model authored directly for this
camera would need none.

Also note: `Object3D.clone()` shares geometry/material *by reference*
across every clone of a template, so `instantiateModel()` explicitly clones
each mesh's material per instance — without that, per-instance tinting
(`relationTint` in `Map3DOverlay.tsx`) would mutate the one shared material
every clone points at, compounding darker with every new instance.

## Optimising a large/detailed source asset

If a future 3D asset is a big scene rather than a single small prop, don't
drop it in as-is:

1. Downsample textures first if they're larger than the model will ever
   render at — `sips --resampleHeightWidthMax 256 file.jpeg` (macOS
   built-in) is usually enough for a few-dozen-pixel map icon.
2. **Node/mesh count, not texture size or on-screen pixel size, drives
   frame rate** once an asset gets cloned across every active partner (up
   to 3 antimeridian tile copies × ~20 partners) — a 1,295-node scene ran
   at ~1 FPS this way. `npx @gltf-transform/cli optimize <input>
   <output.glb> --compress meshopt` joins/instances/flattens the graph
   into as few draw calls as practical.
3. `--compress meshopt` needs a decoder registered before load or
   `GLTFLoader` throws — already wired up in `components/map3d/models.ts`
   via `three/examples/jsm/libs/meshopt_decoder.module.js` (ships with
   `three`, no new dependency), so this is a non-issue for any future
   asset.
4. To compose several small props into one arrangement, use
   `@gltf-transform/core`'s `NodeIO` + `@gltf-transform/functions`'s
   `mergeDocuments()` (not `Document.merge()`, which throws telling you to
   use that instead) to position and merge them, then run the result
   through `optimize` as in step 2. Write the merged doc as `.gltf` first —
   GLB export rejects a multi-buffer document (`GLB must have 0-1
   buffers`), and a freshly-merged doc keeps one buffer per source.

**If profiling any of this**: headless Chromium defaults to *software*
rendering (SwiftShader) unless launched with GPU flags (on macOS:
`--use-gl=angle --use-angle=metal --enable-gpu`) — a measurement taken
without those flags reads as catastrophically slow regardless of the
asset. Confirm `unmaskedRenderer` via `WEBGL_debug_renderer_info` before
trusting a slow reading.

## Swapping in more real art

Free CC0 low-poly packs that fit this project's style, if a future 3D
asset is needed:

- Boats/ships: Kenney "Watercraft Kit" or "Pirate Kit" (https://kenney.nl).
- Buildings/props: Kenney "City Kit (Commercial)".
- Alternative source: Quaternius models via Poly Pizza
  (https://poly.pizza, CC0, glTF export).

Both require a browser to pick a specific file (JS-rendered site / an API
key for programmatic search) — swap the file at the same path (and its
texture, if any, at the relative path its glTF material references) and
the loader in `components/map3d/models.ts` picks it up with no code change
beyond `AXIS_CORRECTIONS` if its authored orientation needs it.
