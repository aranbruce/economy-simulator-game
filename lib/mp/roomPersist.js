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

const ROOM_TTL_SEC = 60 * 60 * 6; // 6 hours
const KEY_PREFIX = "econmp:room:";

function roomsMap() {
  const g = globalThis;
  if (!g.__econMpRooms) g.__econMpRooms = new Map();
  return g.__econMpRooms;
}

function kvConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    "";
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    "";
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
 */
export function mpStoreMode() {
  if (kvConfig()) return "kv";
  if (process.env.VERCEL) return "memory-vercel";
  return "memory";
}

function roomKey(code) {
  return KEY_PREFIX + String(code || "").toUpperCase();
}

async function kvCommand(args) {
  const cfg = kvConfig();
  if (!cfg) throw new Error("KV not configured");
  const res = await fetch(`${cfg.url}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`KV ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(String(data.error));
  return data.result;
}

export async function loadRoom(codeStr) {
  const key = String(codeStr || "").toUpperCase();
  if (!key) return null;
  const cfg = kvConfig();
  if (cfg) {
    try {
      const raw = await kvCommand(["GET", roomKey(key)]);
      if (raw == null || raw === "") return null;
      const room = typeof raw === "string" ? JSON.parse(raw) : raw;
      /* Mirror into process memory for same-instance follow-ups. */
      roomsMap().set(key, room);
      return room;
    } catch (err) {
      console.error("[mp] KV load failed", err);
      return roomsMap().get(key) || null;
    }
  }
  return roomsMap().get(key) || null;
}

export async function saveRoom(room) {
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
    console.error("[mp] KV save failed", err);
    throw err;
  }
}

export async function deleteRoom(codeStr) {
  const key = String(codeStr || "").toUpperCase();
  roomsMap().delete(key);
  const cfg = kvConfig();
  if (!cfg) return;
  try {
    await kvCommand(["DEL", roomKey(key)]);
  } catch (err) {
    console.error("[mp] KV delete failed", err);
  }
}

export async function roomExists(codeStr) {
  const room = await loadRoom(codeStr);
  return !!room;
}

/** Test helper — wipe process memory (KV keys left to TTL). */
export function _resetRoomsForTests() {
  roomsMap().clear();
}

export { roomsMap };
