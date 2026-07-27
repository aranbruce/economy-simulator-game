/**
 * In-memory multiplayer rooms. Survives Next.js HMR via globalThis.
 * Create/join/leave stay free of the sim engine so lobby APIs stay fast.
 * Start/submit live in roomPlay.js.
 */
import { realmByRole } from "../sim/realms.js";

function seatIdForRole(role) {
  return !role || role === "home" ? "kingdom" : role;
}

export function roomsMap() {
  const g = globalThis;
  if (!g.__econMpRooms) g.__econMpRooms = new Map();
  return g.__econMpRooms;
}

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[(Math.random() * alphabet.length) | 0];
  }
  return s;
}

function token() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export function publicRoom(room, viewerToken) {
  const me = viewerToken
    ? Object.values(room.players).find((p) => p.token === viewerToken)
    : null;
  const pol =
    me && room.snapshot && room.snapshot.politics
      ? room.snapshot.politics[me.seatId]
      : null;
  return {
    code: room.code,
    status: room.status,
    q: room.snapshot ? room.snapshot.q : 0,
    version: room.version,
    hostTokenMatch: !!(me && me.token === room.hostToken),
    players: Object.values(room.players).map((p) => ({
      name: p.name,
      seatId: p.seatId,
      role: p.role,
      ready: !!room.submitted[p.seatId],
      isHost: p.token === room.hostToken,
      isYou: !!(me && me.token === p.token),
    })),
    submittedCount: Object.keys(room.submitted).length,
    humanCount: Object.keys(room.players).length,
    you: me
      ? {
          seatId: me.seatId,
          role: me.role,
          name: me.name,
          submitted: !!room.submitted[me.seatId],
          capital: pol && pol.capital != null ? pol.capital : null,
        }
      : null,
    snapshot: room.status === "playing" ? room.snapshot : null,
  };
}

export function createRoom({ hostName, role } = {}) {
  const realm = realmByRole(role || "home");
  const seatId = seatIdForRole(realm.role);
  let c = code();
  const map = roomsMap();
  while (map.has(c)) c = code();
  const hostTok = token();
  const room = {
    code: c,
    hostToken: hostTok,
    status: "lobby",
    version: 1,
    snapshot: null,
    submitted: {},
    players: {
      [hostTok]: {
        token: hostTok,
        name: (hostName || "Host").slice(0, 34),
        role: realm.role,
        seatId,
      },
    },
  };
  map.set(c, room);
  return { room: publicRoom(room, hostTok), token: hostTok };
}

export function getRoom(codeStr, viewerToken) {
  const room = roomsMap().get(String(codeStr || "").toUpperCase());
  if (!room) return null;
  return publicRoom(room, viewerToken);
}

export function joinRoom(codeStr, { name, role } = {}) {
  const room = roomsMap().get(String(codeStr || "").toUpperCase());
  if (!room) return { error: "Room not found", status: 404 };
  if (room.status !== "lobby") {
    return { error: "Game already started", status: 409 };
  }
  const realm = realmByRole(role || "home");
  const seatId = seatIdForRole(realm.role);
  const taken = Object.values(room.players).some((p) => p.seatId === seatId);
  if (taken) return { error: "That seat is taken", status: 409 };
  const tok = token();
  room.players[tok] = {
    token: tok,
    name: (name || realm.name).slice(0, 34),
    role: realm.role,
    seatId,
  };
  room.version += 1;
  return { room: publicRoom(room, tok), token: tok };
}

/**
 * Withdraw a pending Deliver while other humans have not all submitted yet.
 */
export function unsubmitBill(codeStr, playerToken) {
  const map = roomsMap();
  const key = String(codeStr || "").toUpperCase();
  const room = map.get(key);
  if (!room) return { error: "Room not found", status: 404 };
  if (room.status !== "playing") {
    return { error: "Game not in play", status: 409 };
  }
  const player = room.players[playerToken];
  if (!player) return { error: "Not in this room", status: 403 };
  if (!room.submitted[player.seatId]) {
    return {
      room: publicRoom(room, playerToken),
      withdrawn: false,
    };
  }
  delete room.submitted[player.seatId];
  room.version += 1;
  return {
    room: publicRoom(room, playerToken),
    withdrawn: true,
  };
}

/**
 * Host deletes the room. Guest in lobby is removed; guest in play is a no-op.
 */
export function leaveRoom(codeStr, playerToken) {
  const map = roomsMap();
  const key = String(codeStr || "").toUpperCase();
  const room = map.get(key);
  if (!room) return { error: "Room not found", status: 404 };
  if (!room.players[playerToken]) {
    return { error: "Not in this room", status: 403 };
  }
  if (playerToken === room.hostToken) {
    map.delete(key);
    return { ok: true, deleted: true };
  }
  if (room.status === "lobby") {
    delete room.players[playerToken];
    room.version += 1;
    return { ok: true, deleted: false, room: publicRoom(room, null) };
  }
  return { ok: true, deleted: false };
}

/** Test helper — wipe all rooms. */
export function _resetRoomsForTests() {
  roomsMap().clear();
}
