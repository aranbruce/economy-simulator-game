# 3D model assets

- `ships/ship-small.glb`, `ships/ship-medium.glb`, `ships/ship-large.glb` —
  the trade-route vessels, from Kenney's **Pirate Kit** (CC0, see
  `ships/License.txt`; crediting `www.kenney.nl` is appreciated but not
  required). Three hull sizes of the same merchant ship, picked per route by
  its share of world trade — see `VESSEL_CLASSES` in
  `components/map3d/boats.ts`. All three reference one external texture at
  `ships/Textures/colormap.png` by that relative path, so the browser fetches
  it once however many classes a game uses — keep the `Textures/` subfolder
  alongside the `.glb` files if any of them is swapped, or the texture will
  silently fail to resolve (the loader falls back to an untextured material
  rather than erroring).

  These replaced a single `cargo-container-a` prop that stood in for a boat
  on the flat map. It was chosen when the camera looked straight down and a
  hull would have been unreadable; in a pitched 3D scene a real hull is both
  legible and better suited to the board's aged-atlas look.

Capital-city markers are **not** a GLTF asset — they're built as geometry
in `components/map3d/routes.ts` (a five-sided spire on a disc, planted on
the land surface), so they carry no licensing of their own. Three earlier
approaches were tried and dropped: a detailed Sketchfab city scene and a
composed Kenney building cluster (style mismatch, and for the first a
CC-BY attribution requirement), then a flat star-in-a-circle SVG drawn
onto the 2D canvas, which had nowhere sensible to sit once the board
gained real thickness.

## Orienting a new model

The scene is a genuine 3D world: y up, north at -z, the camera pitched
above the board (`components/map3d/camera.ts`). Kenney-style assets are
authored y-up with -z forward, which is exactly what `bezierHeading()` in
`components/map3d/boats.ts` computes a route heading for — so `boat` needs
no correction and `instantiateModel()` applies none. An asset authored to
some other convention would need a per-model-key correction quaternion
reintroduced in `components/map3d/models.ts`, applied once at
instantiation.

Scale is normalised, not authored: `fleet.ts` measures the loaded model and
scales it to a hull length in world units, so a replacement asset does not
have to be modelled at any particular size. It measures the **z** extent
specifically, not the largest axis of the bounding box — these ships are
taller (masts, ~10 units) than they are long (~9-13 units), so normalising
the longest axis would scale every class to the same rigging height and
leave the hulls stubby and indistinguishable.

Also note: `Object3D.clone()` shares geometry/material *by reference*
across every clone of a template, so `instantiateModel()` explicitly
clones each mesh's material per instance — without that, per-instance
tinting (`relationTint`, applied by `fleet.ts`) would mutate the one shared
material every clone points at, compounding darker with every new
instance.

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
