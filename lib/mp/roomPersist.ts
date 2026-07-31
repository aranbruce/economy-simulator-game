/**
 * Durable multiplayer room backend.
 *
 * Prefer Vercel KV / Upstash Redis REST (shared across serverless instances).
 * Fall back to in-memory Map for local `pnpm dev` and unit tests.
 *
 * Env (either pair works):
 *   KV_REST_API_URL + KV_REST_API_TOKEN
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
import type { Room } from "./types.ts";

const ROOM_TTL_SEC = 60 * 60 * 6; // 6 hours
const KEY_PREFIX = "econmp:room:";
const KV_TIMEOUT_MS = 4000;
/** Don't spam the terminal when SSE polls pile into timeouts. */
const KV_LOG_COOLDOWN_MS = 30000;
const _kvLogAt = new Map<string, number>();

declare global {
  var __econMpRooms: Map<string, Room> | undefined;
}

function roomsMap(): Map<string, Room> {
  const g = globalThis;
  if (!g.__econMpRooms) g.__econMpRooms = new Map();
  return g.__econMpRooms;
}

function kvConfig() {
  const url =
    process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

/** True when this process can share rooms across Vercel instances. */
export function hasDurableMpStore() {
  return !!kvConfig();
}

/**
 * On Vercel without KV, in-memory rooms vanish between instances — the classic
 * "room has ended" 404 on Deliver. Local Node keeps one process, so memory is fine.
 * (`vercel env pull` sets VERCEL=1 locally; only treat real deploys as memory-vercel.)
 */
export function mpStoreMode() {
  if (kvConfig()) return "kv";
  if (process.env.VERCEL && process.env.NODE_ENV === "production") {
    return "memory-vercel";
  }
  return "memory";
}

function roomKey(code: string) {
  return KEY_PREFIX + String(code || "").toUpperCase();
}

function logKvFailure(kind: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const key =
    kind + ":" + (msg.includes("timed out") ? "timeout" : msg.slice(0, 80));
  const now = Date.now();
  const prev = _kvLogAt.get(key) || 0;
  if (now - prev < KV_LOG_COOLDOWN_MS) return;
  _kvLogAt.set(key, now);
  console.error("[mp] KV " + kind + " failed", err);
}

async function kvCommand(args: unknown[]) {
  const cfg = kvConfig();
  if (!cfg) throw new Error("KV not configured");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), KV_TIMEOUT_MS);
  try {
    const res = await fetch(`${cfg.url}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`KV ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(String(data.error));
    return data.result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("KV timed out after " + KV_TIMEOUT_MS + "ms");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Local/dev: keep lobby usable if Redis is down or misconfigured.
 * `vercel env pull` writes VERCEL=1 into .env.local, so do not key off that alone —
 * only refuse fallback in a real production/preview deploy.
 */
function allowMemoryFallback() {
  return process.env.NODE_ENV !== "production";
}

/**
 * @param {string} codeStr
 * @param {{ preferMemory?: boolean }} [opts]
 *   preferMemory — return the process cache without hitting Redis (SSE ticks on
 *   a single Node process; saves still write memory first).
 */
function cloneRoom(room: Room | null | undefined): Room | null {
  if (!room) return null;
  return JSON.parse(JSON.stringify(room));
}

export async function loadRoom(
  codeStr: string,
  opts: { preferMemory?: boolean } = {},
): Promise<Room | null> {
  const key = String(codeStr || "").toUpperCase();
  if (!key) return null;
  const mem = roomsMap().get(key) || null;
  if (opts.preferMemory && mem) return cloneRoom(mem);

  const cfg = kvConfig();
  if (cfg) {
    try {
      const raw = await kvCommand(["GET", roomKey(key)]);
      if (raw == null || raw === "") {
        /* Local fallback create may exist only in memory after a failed SET. */
        if (allowMemoryFallback()) return cloneRoom(mem);
        roomsMap().delete(key);
        return null;
      }
      const room = typeof raw === "string" ? JSON.parse(raw) : raw;
      /* Mirror into process memory for same-instance follow-ups. */
      roomsMap().set(key, room);
      return cloneRoom(room);
    } catch (err) {
      logKvFailure("load", err);
      /* Production must not mutate a stale per-instance cache after Redis fails. */
      if (allowMemoryFallback()) return cloneRoom(mem);
      return null;
    }
  }
  return cloneRoom(mem);
}

export async function saveRoom(room: Room) {
  if (!room || !room.code) return;
  const key = String(room.code).toUpperCase();
  roomsMap().set(key, room);
  const cfg = kvConfig();
  if (!cfg) return;
  try {
    await kvCommand([
      "SET",
      roomKey(key),
      JSON.stringify(room),
      "EX",
      String(ROOM_TTL_SEC),
    ]);
  } catch (err) {
    logKvFailure("save", err);
    if (allowMemoryFallback()) return;
    throw err;
  }
}

/**
 * Compare-and-swap save: write only if the stored room still has expectedVersion.
 * Callers load a clone, mutate, bump version, then pass the pre-mutate version here.
 * Returns false on conflict (caller should reload / 409).
 */
export async function saveRoomCas(room: Room, expectedVersion: number) {
  if (!room || !room.code) return false;
  const key = String(room.code).toUpperCase();
  const expect = Number(expectedVersion);
  const cfg = kvConfig();

  if (!cfg) {
    const cur = roomsMap().get(key);
    if (cur && Number(cur.version) !== expect) return false;
    roomsMap().set(key, room);
    return true;
  }

  const script = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  if tostring(ARGV[1]) ~= '0' and ARGV[1] ~= '' then return 0 end
  redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
  return 1
end
local ok, doc = pcall(cjson.decode, raw)
if not ok or type(doc) ~= 'table' then return 0 end
if tostring(doc['version']) ~= tostring(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;
  try {
    const result = await kvCommand([
      "EVAL",
      script,
      "1",
      roomKey(key),
      String(expect),
      JSON.stringify(room),
      String(ROOM_TTL_SEC),
    ]);
    if (result !== 1 && result !== true) {
      try {
        const raw = await kvCommand(["GET", roomKey(key)]);
        if (raw != null && raw !== "") {
          const fresh = typeof raw === "string" ? JSON.parse(raw) : raw;
          roomsMap().set(key, fresh);
        }
      } catch (refreshErr) {
        logKvFailure("cas-refresh", refreshErr);
      }
      return false;
    }
    roomsMap().set(key, room);
    return true;
  } catch (err) {
    logKvFailure("cas", err);
    if (allowMemoryFallback()) {
      const cur = roomsMap().get(key);
      if (cur && Number(cur.version) !== expect) return false;
      roomsMap().set(key, room);
      return true;
    }
    throw err;
  }
}

/**
 * Create only if the code is free. One Redis round-trip (SET NX) when KV is on.
 * Returns true if this process now owns the key.
 */
export async function saveRoomIfAbsent(room: Room) {
  if (!room || !room.code) return false;
  const key = String(room.code).toUpperCase();
  if (roomsMap().has(key)) return false;

  const cfg = kvConfig();
  if (!cfg) {
    roomsMap().set(key, room);
    return true;
  }
  try {
    const result = await kvCommand([
      "SET",
      roomKey(key),
      JSON.stringify(room),
      "EX",
      String(ROOM_TTL_SEC),
      "NX",
    ]);
    /* Redis/Upstash: "OK" on success, null when the key already exists. */
    if (result !== "OK" && result !== true) return false;
    roomsMap().set(key, room);
    return true;
  } catch (err) {
    logKvFailure("saveIfAbsent", err);
    if (allowMemoryFallback()) {
      roomsMap().set(key, room);
      return true;
    }
    throw err;
  }
}

export async function deleteRoom(codeStr: string) {
  const key = String(codeStr || "").toUpperCase();
  roomsMap().delete(key);
  const cfg = kvConfig();
  if (!cfg) return;
  try {
    await kvCommand(["DEL", roomKey(key)]);
  } catch (err) {
    logKvFailure("delete", err);
  }
}

export async function roomExists(codeStr: string) {
  const key = String(codeStr || "").toUpperCase();
  if (!key) return false;
  if (roomsMap().has(key)) return true;
  const cfg = kvConfig();
  if (!cfg) return false;
  try {
    const n = await kvCommand(["EXISTS", roomKey(key)]);
    return n === 1 || n === true;
  } catch (err) {
    logKvFailure("exists", err);
    return false;
  }
}

/** Test helper — wipe process memory (KV keys left to TTL). */
export function _resetRoomsForTests() {
  roomsMap().clear();
}

export { roomsMap };
