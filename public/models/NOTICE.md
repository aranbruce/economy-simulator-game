# 3D model assets

All models below are Creative Commons Zero (CC0) — free for personal and
commercial use. Boats, trees and buildings are Kenney packs (credit
"Kenney" / [kenney.nl](https://kenney.nl) is appreciated, not required).
Clouds and mountains are Quaternius (credit
[quaternius.com](https://quaternius.com) appreciated, not required).
Original `License.txt` files sit next to each group. Trees were converted
from the Nature Kit's OBJ to GLB with `obj2gltf` so they load through the
same `GLTFLoader` path as everything else; geometry and materials are
unchanged.

- `boats/boat.glb` — Kenney Watercraft Kit `ship-cargo-a`. A container ship
  on the trade routes (replacing an earlier cargo-container prop from the
  same pack). Texture at `boats/Textures/colormap.png`, referenced from the
  glTF material by that relative path — keep the `Textures/` subfolder
  alongside the `.glb`.
- `trees/tree_{default,cone,oak,palm}.glb` — Kenney Nature Kit 2.1. Instanced
  only where NASA IGBP forest cover is real woodland (`public/geo/tree-cover.bin`),
  so a large country is not a uniform thicket: Amazon and Atlantic forest,
  not the sertão; taiga, not the steppe. Kind follows the cell's dominant
  class (needleleaf → cone, rainforest → oak/default). No external texture.
- `cities/building-{a,c,e,j,n,wide-a,wide-b}.glb` — Kenney City Kit
  Commercial 2.1 (`low-detail-building-*`, `wide-a`/`wide-b` from
  `low-detail-building-wide-*`). Clustered as a small city around each
  capital, rendered with their shipped `cities/Textures/colormap.png`
  colormap rather than a flat tint — the one building-cluster exception to
  the flat-tinted treatment trees and mountains get, matching how boats and
  diplo props already keep their real textures.
- `clouds/cloud-{a,e}.glb` — Quaternius (CC0) via Poly Pizza: Cloud1
  and Cloud4. Lumpy elongated and wide banks (the spiral Cloud5 was
  dropped). Instanced as drifting weather. No external texture.
  Optimised with `gltf-transform optimize --compress meshopt`.
- `mountains/{hill,peak,range}.glb` — Quaternius (CC0) via Poly Pizza:
  Mountain_Single, MountainLarge_Single and Mountain_Group_2. Kenney
  Nature Kit has rocks and cliff *tiles*, not mountain silhouettes, so
  these come from the same source as the clouds. Instanced only on
  NASA SRTM topography (`public/geo/elevation.bin`) — Alps, Andes,
  Himalaya, Rockies, not a scatter across the plains. Kind follows
  height and whether the cell sits in a chain (snow peak, range, or
  bare hill). No external texture. Optimised with `gltf-transform
  optimize --compress meshopt`.
- `diplo/{envoy,tent,target}.glb` — Kenney Mini Characters 1.0
  (`character-male-d`, the navy business suit), Survival Kit 2.0
  (`tent-canvas`), and Blaster Kit 2.1 (`target-large`). Planted beside
  a capital for a live envoy, summit or sanctions. Each glTF points at
  its own atlas under `diplo/Textures/` (`mini.png`, `survival.png`,
  `blaster.png`) — they cannot share one `colormap.png` or UVs sample
  the wrong pack. `envoy.glb` is the Mini Characters OBJ baked to a
  static mesh (no skin/clips) so it draws without an animation mixer.
  `diploProps.ts` keeps those maps (Lambert, white albedo) and yaws the
  target to face the atlas camera. Protests use a standing bang mesh
  and ultimatums a crossed-swords mesh, both built in `diploProps.ts`.

## Orienting a new model

The scene is a genuine 3D world with y up, and every Kenney asset in
public/models is authored y-up with -z forward, the same convention
`bezierHeading()` computes a route heading for. Quaternius clouds are
the same y-up convention. Quaternius mountains were Z-up in the source
file; the copies in `public/models/mountains` have that rotation baked
into the vertices so instancing does not have to replay a parent-node
tilt. An asset authored to some other convention
would need a per-key correction quaternion on `instantiateModel()`;
none of the current files need one.

Also note: `Object3D.clone()` shares geometry/material *by reference*
across every clone of a template, so `instantiateModel()` explicitly clones
each mesh's material per instance — without that, per-instance tinting
(`relationTint` in `fleet.ts`) would mutate the one shared material every
clone points at, compounding darker with every new instance.

Trees, mountains and clouds do **not** clone per instance: `scenery.ts`
builds one `InstancedMesh` per submesh and packs the three wrap tiles
into the same instance buffer. A cloned Object3D per tree would hit
the same node-count wall described below.

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
   `three`, no new dependency), so this is a no-issue for any future
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

Free CC0 low-poly packs that fit this project's style:

- Boats/ships: Kenney "Watercraft Kit" (https://kenney.nl/assets/watercraft-kit).
- Buildings/props: Kenney "City Kit (Commercial)".
- Trees/rocks: Kenney "Nature Kit".
- Mountains/clouds: Quaternius via Poly Pizza (https://poly.pizza/u/Quaternius).
- Alternative source: Quaternius models via Poly Pizza
  (https://poly.pizza, CC0, glTF export).

Swap a file at the same path (and its texture, if any, at the relative
path its glTF material references) and the loader in
`components/map3d/models.ts` picks it up with no code change, provided
the `MODEL_URLS` key already exists.
