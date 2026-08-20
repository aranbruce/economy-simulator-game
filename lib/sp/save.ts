/** Persist a single-player game across page loads, mirroring lib/mp/session.ts's
 *  localStorage pattern. Unlike a multiplayer resume, this snapshot keeps the
 *  in-progress draft, unanswered press clips, the morning briefing and coach
 *  state — see exportGameSnapshot/hydrateGameSnapshot's `mode: "solo"` opts
 *  in lib/sim/engine.ts, which this module never touches directly. */

const KEY = "econ-sp-save";
const VERSION = 1;

export interface SpSaveMeta {
  country: string;
  homeRole: string;
  homeIso: string;
  q: number;
  term: number;
  sandbox: boolean;
}

export interface SpSave {
  v: number;
  savedAt: number;
  meta: SpSaveMeta;
  snap: any;
}

/** `meta.q`'s shape changes with the model — refuse a stale schema rather
 *  than hydrate a game half-matching the current engine. Bump VERSION on any
 *  change to what G carries. */
export function saveSpGame(snap: any, meta: SpSaveMeta) {
  if (typeof localStorage === "undefined" || !snap) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: VERSION, savedAt: Date.now(), meta, snap }),
    );
  } catch {
    /* private mode / quota */
  }
}

export function loadSpSave(): SpSave | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== VERSION || !data.snap || !data.meta) return null;
    return data as SpSave;
  } catch {
    return null;
  }
}

export function clearSpSave() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
