/**
 * A skydome that wraps the board. Scene.background is a flat colour, which
 * reads as a wall once the camera pitches toward the horizon; a dome gives
 * the far water somewhere to meet and a warm haze to fog into.
 *
 * Follows the camera so the sphere can stay finite without the view ever
 * reaching its surface. Fog is off — the dome *is* the thing fog fades to.
 */

import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";

export interface Sky {
  mesh: Mesh;
  update: (cameraPosition: Vector3) => void;
  dispose: () => void;
}

export function createSky(): Sky {
  const geometry = new SphereGeometry(2200, 32, 20);
  const material = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: new Color(0x3a3228) },
      uHaze: { value: new Color(0x7a6a54) },
      uHorizon: { value: new Color(0xb4a48c) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uZenith;
      uniform vec3 uHaze;
      uniform vec3 uHorizon;
      void main() {
        float h = vDir.y;
        vec3 col = mix(uHorizon, uHaze, smoothstep(-0.08, 0.16, h));
        col = mix(col, uZenith, smoothstep(0.10, 0.70, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -20;

  return {
    mesh,
    update(cameraPosition: Vector3) {
      mesh.position.copy(cameraPosition);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
