/**
 * A faint lat/long ruling on the sea, so the board reads as a printed
 * atlas rather than an empty plate. Screen-space hairlines, same family
 * as the country outlines — they stay a thread at every zoom.
 *
 * Depth-tested against the land, so the ruling sits on the water and
 * tucks under the slabs. One plane only — a second copy on the caps
 * reads as a doubled grid. Pure of game logic.
 */

import { Group } from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  BOARD_H,
  BOARD_W,
  LAT_MAX,
  LAT_MIN,
  WRAP_OFFSETS,
  boardToWorld,
} from "../../lib/map/projection.ts";
import { SEA_Y } from "./sea.ts";

/** Bump so WorldMap3D remounts when the ruling changes. */
export const BOARD_GRID_REV = 2;

const LON_STEP = 15;
const LAT_STEP = 10;
const GRID_Y = SEA_Y + 0.03;

export interface BoardGrid {
  group: Group;
  dispose: () => void;
}

function gridPositions(): number[] {
  const pos: number[] = [];
  const zNorth = boardToWorld(0, 0)[1];
  const zSouth = boardToWorld(0, 1)[1];
  const xWest = -BOARD_W / 2;
  const xEast = BOARD_W / 2;

  for (let lon = -180; lon < 180; lon += LON_STEP) {
    const x = (lon / 360) * BOARD_W;
    pos.push(x, GRID_Y, zNorth, x, GRID_Y, zSouth);
  }

  const lat0 = Math.ceil(LAT_MIN / LAT_STEP) * LAT_STEP;
  for (let lat = lat0; lat < LAT_MAX; lat += LAT_STEP) {
    const ny = (LAT_MAX - lat) / BOARD_H;
    const z = boardToWorld(0.5, ny)[1];
    pos.push(xWest, GRID_Y, z, xEast, GRID_Y, z);
  }
  return pos;
}

export function createBoardGrid(): BoardGrid {
  const group = new Group();
  const geom = new LineSegmentsGeometry();
  geom.setPositions(gridPositions());
  const mat = new LineMaterial({
    color: 0x2b2417,
    linewidth: 0.9,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    toneMapped: false,
    fog: true,
  });
  for (const dx of WRAP_OFFSETS) {
    const line = new LineSegments2(geom, mat);
    line.position.x = dx;
    line.renderOrder = 0;
    group.add(line);
  }

  return {
    group,
    dispose() {
      geom.dispose();
      mat.dispose();
      group.clear();
    },
  };
}
