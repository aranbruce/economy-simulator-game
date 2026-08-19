/**
 * The sea the board sits on: a large subdivided plane with a cheap swell
 * displacement, plus a fragment shader so the water reads as a surface
 * rather than a tinted fill.
 *
 * Stylised, not photographic — the board is an atlas, and the CSS sepia
 * grade on the canvas already pulls everything toward parchment. Colour
 * stays in a teal-olive family so the grade still lands — glancing
 * highlights stay in that family too, not the skydome's gold haze,
 * or the whole plate reads as orange under the warm key light.
 *
 * Colour is a volume, not a fill: a longer shelf distance in the same
 * coast map shallows the water near land, swell troughs absorb, and a
 * cheap subsurface wrap lights the crests as if the wave had thickness.
 *
 * Pure of game logic: it is a mesh and a clock.
 */

import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  NoColorSpace,
  PlaneGeometry,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
  type IUniform,
  type Texture,
} from "three";
import { BOARD_H, BOARD_W } from "../../lib/map/projection.ts";
import { type Polys } from "../../lib/map/geo.ts";

/** Matches WorldMap3D's previous sea plane — only ever seen edge-on
 *  through fog, so it just has to outrun the far plane of any zoom. */
export const SEA_SIZE = 5000;
/** Still-water line, part-way up the country walls so the sea
 *  meets the slab instead of leaving a dark cliff at the cap. Wave
 *  troughs stay above LAND_DRAFT. */
export const SEA_Y = 0.18;
/** Base albedo. Muted gray-teal, like the printed seas in the Suzerain
 *  atlas rather than sage olive or a photographic ocean. */
export const SEA_COLOR = 0x5c7a78;
/** Bump when the sea program changes so WorldMap3D remounts the scene —
 *  Fast Refresh will not otherwise rebuild the WebGL effect. */
export const SEA_SHADER_REV = 25;

const COAST_W = 2048;
const COAST_H = 800;
/** Surf width in texels. Peak is at the land edge so the white line
 *  kisses the country wall; it must not start a gutter offshore. */
const FOAM_TEXELS = 10;
/** Wider shelf used for shallow → deep colour. ~25 world units. */
const SHELF_TEXELS = 140;

/** Object-space swell on the sea plane (z-up before the −π/2 pitch; world
 *  Y after). The vertex shader and `seaHeight()` share these so boats sit
 *  on the surface that is actually drawn, not a flat stand-in. Chop and
 *  glitter live only in the fragment shader — they must not bob the hull. */
const WAVE = {
  a: { k: 0.048, amp: 0.055, speed: 0.32 },
  b: { k: 0.062, amp: 0.038, speed: 0.24 },
  c: { k: 0.033, amp: 0.024, speed: 0.15 },
} as const;
/** Constructive peak of WAVE — fragment colour and SSS scale against this
 *  so quieter swell still reads as troughs and crests. */
const WAVE_PEAK = WAVE.a.amp + WAVE.b.amp + WAVE.c.amp;

/** Sun direction matching WorldMap3D's key light (northwest, raking).
 *  Hardcoded so the glitter lobe tracks the same light the land uses
 *  without threading a uniform from the scene graph. */
const SUN_DIR = "normalize(vec3(-0.573, 0.614, -0.430))";

function glslRgb(hex: number): string {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  return `vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`;
}

/** World-Y of the sea surface at `(x, z)` — the same displacement the
 *  shader applies, so a boat sampling this is in the water, not hovering
 *  over a trough. Plane is pitched −π/2, so world `(x, z)` is plane-local
 *  `(x, −z)`. */
export function seaHeight(x: number, z: number, t: number): number {
  const lx = x;
  const ly = -z;
  const { a, b, c } = WAVE;
  return (
    SEA_Y +
    Math.sin(lx * a.k + t * a.speed) * a.amp +
    Math.cos(ly * b.k + t * b.speed) * b.amp +
    Math.sin((lx + ly) * c.k + t * c.speed) * c.amp
  );
}

function rasterLand(countries: { polys: Polys }[]): Uint8Array {
  const land = new Uint8Array(COAST_W * COAST_H);
  const canvas = document.createElement("canvas");
  canvas.width = COAST_W;
  canvas.height = COAST_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return land;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, COAST_W, COAST_H);
  ctx.fillStyle = "#fff";
  for (const c of countries) {
    for (const rings of c.polys) {
      if (!rings.length) continue;
      ctx.beginPath();
      for (const ring of rings) {
        if (ring.length < 3) continue;
        ctx.moveTo(ring[0]![0] * COAST_W, ring[0]![1] * COAST_H);
        for (let i = 1; i < ring.length; i++) {
          ctx.lineTo(ring[i]![0] * COAST_W, ring[i]![1] * COAST_H);
        }
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
  }
  const pix = ctx.getImageData(0, 0, COAST_W, COAST_H).data;
  /* Any coverage counts as land so the SDF does not sit inside the
     extruded slab (canvas AA would otherwise shrink the mask and leave
     a strip of water between the wall and the surf). */
  for (let i = 0; i < land.length; i++) land[i] = pix[i * 4]! > 8 ? 1 : 0;
  return land;
}

function chamferDist(land: Uint8Array): Uint8Array {
  const dist = new Float32Array(COAST_W * COAST_H);
  for (let i = 0; i < dist.length; i++) dist[i] = land[i] ? 0 : SHELF_TEXELS;
  const n8: [number, number, number][] = [
    [-1, -1, 1.414],
    [0, -1, 1],
    [1, -1, 1.414],
    [-1, 0, 1],
    [1, 0, 1],
    [-1, 1, 1.414],
    [0, 1, 1],
    [1, 1, 1.414],
  ];
  const pass = (fwd: boolean) => {
    const r0 = fwd ? 0 : COAST_H - 1;
    const r1 = fwd ? COAST_H : -1;
    const rd = fwd ? 1 : -1;
    const c0 = fwd ? 0 : COAST_W - 1;
    const c1 = fwd ? COAST_W : -1;
    const cd = fwd ? 1 : -1;
    for (let r = r0; r !== r1; r += rd) {
      for (let c = c0; c !== c1; c += cd) {
        const i = r * COAST_W + c;
        let d = dist[i]!;
        if (d === 0) continue;
        for (const [dc, dr, cost] of n8) {
          const nr = r + dr;
          if (nr < 0 || nr >= COAST_H) continue;
          const nc = ((c + dc) % COAST_W + COAST_W) % COAST_W;
          d = Math.min(d, dist[nr * COAST_W + nc]! + cost);
        }
        dist[i] = d;
      }
    }
  };
  pass(true);
  pass(false);
  const out = new Uint8Array(COAST_W * COAST_H * 4);
  for (let i = 0; i < dist.length; i++) {
    const foam = Math.min(255, (dist[i]! / FOAM_TEXELS) * 255);
    const shelf = Math.min(255, (dist[i]! / SHELF_TEXELS) * 255);
    const o = i * 4;
    out[o] = foam;
    out[o + 1] = shelf;
    out[o + 2] = 0;
    out[o + 3] = 255;
  }
  return out;
}

function dummyCoastTexture(): Texture {
  const tex = new DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType,
  );
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function bakeCoastTexture(countries: { polys: Polys }[]): Texture | null {
  if (!countries.length || typeof document === "undefined") return null;
  const tex = new DataTexture(
    chamferDist(rasterLand(countries)),
    COAST_W,
    COAST_H,
    RGBAFormat,
    UnsignedByteType,
  );
  tex.colorSpace = NoColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export interface Sea {
  mesh: Mesh;
  update: (nowS: number) => void;
  dispose: () => void;
}

export function createSea(countries: { polys: Polys }[] = []): Sea {
  /* Segments exist so the vertex wave has something to bend. 160² is
     ~25k verts — cheap next to the country extrusions, dense enough that
     a long swell doesn't facet when the camera is low. */
  const geometry = new PlaneGeometry(SEA_SIZE, SEA_SIZE, 160, 160);
  const material = new MeshStandardMaterial({
    color: SEA_COLOR,
    roughness: 0.26,
    metalness: 0.0,
  });
  const coast = bakeCoastTexture(countries) ?? dummyCoastTexture();
  const uniforms: {
    uTime: IUniform<number>;
    uCoast: IUniform<Texture | null>;
  } = {
    uTime: { value: 0 },
    uCoast: { value: coast },
  };

  const { a, b, c } = WAVE;
  const abyss = glslRgb(0x384848);
  const deep = glslRgb(0x4a605e);
  const mid = glslRgb(SEA_COLOR);
  const shallow = glslRgb(0x8aa09c);
  const sheen = glslRgb(0xb4c4c0);
  const scatter = glslRgb(0x6a8884);
  const glint = glslRgb(0xe4ece8);
  const foam = glslRgb(0xd8d4c8);

  const varyings = /* glsl */ `
    uniform float uTime;
    varying vec2 vSeaPos;
    varying float vWaveH;
    varying vec2 vSlope;
    varying vec3 vWorldPos;
  `;
  const fragPreamble = /* glsl */ `
    ${varyings}
    uniform sampler2D uCoast;
  `;
  const coastUvGlsl = /* glsl */ `
         /* Do not fract() U — RepeatWrapping already tiles, and a
            fract() jump makes dFdx explode so the wrap meridian
            smears into a striped column. */
         vec2 coastUv = vec2(
           vWorldPos.x / ${BOARD_W}.0 + 0.5,
           clamp(vWorldPos.z / ${BOARD_H}.0 + 0.5, 0.0, 1.0)
         );
         vec4 coastS = texture2D(uCoast, coastUv);
         float foamDist = coastS.r;
         float shelf = coastS.g;
         float surf = pow(1.0 - smoothstep(0.0, 0.12, foamDist), 1.7);
         float wash = 0.90 + 0.10 * sin(dot(vSeaPos, vec2(2.8, 1.9)) + uTime * 1.7);
         float coastFoam = surf * mix(1.0, wash, smoothstep(0.0, 0.10, foamDist));
         coastFoam *= mix(0.16, 1.0, seaClose());
         float deepness = smoothstep(0.06, 0.78, shelf);
  `;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uCoast = uniforms.uCoast;
    shader.vertexShader = varyings + shader.vertexShader;
    shader.fragmentShader = fragPreamble + shader.fragmentShader;

    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      `#include <beginnormal_vertex>
       float t = uTime;
       float wx = ${a.k} * ${a.amp} * cos(position.x * ${a.k} + t * ${a.speed})
                + ${c.k} * ${c.amp} * cos((position.x + position.y) * ${c.k} + t * ${c.speed});
       float wy = -${b.k} * ${b.amp} * sin(position.y * ${b.k} + t * ${b.speed})
                - ${c.k} * ${c.amp} * cos((position.x + position.y) * ${c.k} + t * ${c.speed});
       vSlope = vec2(wx, wy);
       objectNormal = normalize(vec3(-wx, -wy, 1.0));`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vSeaPos = transformed.xy;
       vWaveH = sin(transformed.x * ${a.k} + uTime * ${a.speed}) * ${a.amp}
              + cos(transformed.y * ${b.k} + uTime * ${b.speed}) * ${b.amp}
              + sin((transformed.x + transformed.y) * ${c.k} + uTime * ${c.speed}) * ${c.amp};
       transformed.z += vWaveH;
       vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
       float seaClose() {
         float px = length(fwidth(vWorldPos.xz));
         return 1.0 - smoothstep(0.06, 0.48, px);
       }
       vec2 seaChop(vec2 p, float t) {
         float d0 = dot(p, vec2(1.0, 0.40));
         float d1 = dot(p, vec2(-0.70, 1.0));
         float d2 = dot(p, vec2(0.50, -0.90));
         float d3 = dot(p, vec2(0.85, 0.55));
         float close = seaClose();
         float cx = 0.028 * cos(d0 * 0.31 + t * 0.85)
                  + 0.024 * cos(d1 * 0.47 + t * 1.12)
                  + 0.022 * cos(d2 * 0.93 + t * 1.65)
                  + 0.012 * cos(d3 * 2.4 + t * 2.05);
         float cy = 0.011 * cos(d0 * 0.31 + t * 0.85)
                  + 0.024 * cos(d1 * 0.47 + t * 1.12)
                  + -0.020 * cos(d2 * 0.93 + t * 1.65)
                  + 0.010 * cos(d3 * 2.4 + t * 2.05);
         return vec2(cx, cy) * mix(0.28, 1.0, close);
       }
       vec3 seaWorldNormal(vec2 p, vec2 slope, float t) {
         vec2 coastUv = vec2(
           vWorldPos.x / ${BOARD_W}.0 + 0.5,
           clamp(vWorldPos.z / ${BOARD_H}.0 + 0.5, 0.0, 1.0)
         );
         float inshore = 1.0 - smoothstep(0.06, 0.78, texture2D(uCoast, coastUv).g);
         vec2 c = seaChop(p, t) * mix(1.0, 0.34, inshore);
         return normalize(vec3(-(slope.x + c.x), 1.0, slope.y + c.y));
       }
       float seaHash(vec2 p) {
         vec2 n = fract(p * vec2(123.34, 456.21));
         n += dot(n, n + 45.32);
         return fract(n.x * n.y);
       }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      `#include <normal_fragment_maps>
       {
         vec3 Nworld = seaWorldNormal(vSeaPos, vSlope, uTime);
         normal = normalize((viewMatrix * vec4(Nworld, 0.0)).xyz);
       }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       {
         ${coastUvGlsl}
         float h = clamp(vWaveH / ${WAVE_PEAK.toFixed(3)}, -1.0, 1.0);
         vec3 V = normalize(cameraPosition - vWorldPos);
         vec3 Nworld = seaWorldNormal(vSeaPos, vSlope, uTime);
         float ndv = clamp(dot(Nworld, V), 0.0, 1.0);
         float fres = pow(1.0 - ndv, 2.6);
         float path = 1.0 / max(ndv, 0.12);
         float absorb = 1.0 - exp(-0.55 * path * mix(0.28, 1.15, deepness));
         vec3 water = mix(${shallow}, ${mid}, smoothstep(0.0, 0.45, deepness));
         water = mix(water, ${deep}, smoothstep(0.25, 0.85, deepness));
         water = mix(water, ${abyss}, absorb * mix(0.15, 1.0, deepness));
         water = mix(water, ${abyss}, fres * deepness * 0.32);
         float trough = 1.0 - smoothstep(-0.55, 0.15, h);
         water *= 1.0 - trough * mix(0.06, 0.18, deepness);
         water = mix(water, ${shallow}, smoothstep(0.05, 0.85, h) * (1.0 - deepness) * 0.28);
         float c0 = sin(vSeaPos.x * 0.38 + uTime * 0.42) * sin(vSeaPos.y * 0.51 - uTime * 0.33);
         float c1 = sin((vSeaPos.x + vSeaPos.y) * 0.72 + uTime * 0.55);
         float caustic = 0.5 + 0.5 * (c0 * 0.65 + c1 * 0.35);
         water *= 1.0 + (1.0 - deepness) * (caustic - 0.5) * 0.03 * seaClose();
         water = mix(water, ${sheen}, fres * mix(0.04, 0.16, deepness));
         float gyre = 0.5
           + 0.32 * sin(vWorldPos.x * 0.0075 + vWorldPos.z * 0.0032)
           + 0.18 * sin(vWorldPos.z * 0.0095 - vWorldPos.x * 0.0041);
         water *= 0.94 + 0.09 * gyre;
         float contact = 1.0 - smoothstep(0.0, 0.10, foamDist);
         water *= 1.0 - contact * 0.14;
         water = mix(water, ${foam}, coastFoam * 0.10);
         diffuseColor.rgb = water;
       }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
       {
         ${coastUvGlsl}
         vec3 V = normalize(cameraPosition - vWorldPos);
         vec3 Nworld = seaWorldNormal(vSeaPos, vSlope, uTime);
         float fres = pow(1.0 - clamp(dot(Nworld, V), 0.0, 1.0), 2.2);
         roughnessFactor = mix(0.62, 0.48, deepness);
         roughnessFactor = mix(roughnessFactor, 0.38, fres * 0.25);
         roughnessFactor = mix(roughnessFactor, 0.78, coastFoam);
       }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
       {
         ${coastUvGlsl}
         vec3 V = normalize(cameraPosition - vWorldPos);
         vec3 Nworld = seaWorldNormal(vSeaPos, vSlope, uTime);
         vec3 L = ${SUN_DIR};
         vec3 H = normalize(V + L);
         float ndh = clamp(dot(Nworld, H), 0.0, 1.0);
         float specTight = pow(ndh, 160.0);
         float specBroad = pow(ndh, 10.0);
         float sunFacing = clamp(dot(Nworld, L), 0.0, 1.0);
         float wrap = clamp(dot(Nworld, L) * 0.55 + 0.45, 0.0, 1.0);
         float thin = smoothstep(-0.15, 0.7, vWaveH / ${WAVE_PEAK.toFixed(3)});
         float sss = wrap * thin * mix(0.35, 0.12, deepness);
         totalEmissiveRadiance += ${glint} * specTight * 0.04 * sunFacing;
         totalEmissiveRadiance += ${sheen} * specBroad * 0.025 * sunFacing * mix(0.35, 1.0, deepness);
         totalEmissiveRadiance += ${scatter} * sss * 0.06;
       }`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
      `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
       outgoingLight *= vec3(0.92, 1.0, 0.96);
       ${coastUvGlsl}
       float contact = 1.0 - smoothstep(0.0, 0.10, foamDist);
       outgoingLight *= 1.0 - contact * 0.08;`,
    );
  };
  material.customProgramCacheKey = () => `map-sea-water-v${SEA_SHADER_REV}`;

  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA_Y;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  return {
    mesh,
    update(nowS: number) {
      uniforms.uTime.value = nowS;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      coast?.dispose();
    },
  };
}
