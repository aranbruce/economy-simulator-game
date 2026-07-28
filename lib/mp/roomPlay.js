/**
 * Multiplayer start + lockstep submit — loads the sim engine.
 * Kept separate from roomStore so create/join APIs stay lightweight.
 */
import {
  resolveLockstepQuarter,
  seedMpPolitics,
  validateMpSubmission,
  applyMpEventChoice,
} from "../sim/engine.js";
import { publicRoom } from "./roomStore.js";
import { loadRoom, saveRoom } from "./roomPersist.js";

export async function startRoom(codeStr, hostToken, snapshot) {
  const room = await loadRoom(codeStr);
  if (!room) return { error: "Room not found", status: 404 };
  if (room.hostToken !== hostToken) {
    return { error: "Only the host can start", status: 403 };
  }
  if (room.status !== "lobby") {
    return { error: "Already started", status: 409 };
  }
  if (Object.keys(room.players).length < 2) {
    return { error: "Need at least two players", status: 400 };
  }
  if (!snapshot || !snapshot.world) {
    return { error: "Missing game snapshot", status: 400 };
  }
  const humans = Object.values(room.players).map((p) => ({
    seatId: p.seatId,
    role: p.role,
    name: p.name,
  }));
  seedMpPolitics(snapshot, humans);
  room.snapshot = snapshot;
  room.status = "playing";
  room.submitted = {};
  room.version += 1;
  await saveRoom(room);
  return { room: publicRoom(room, hostToken) };
}

export async function submitBill(codeStr, playerToken, draft, opts = {}) {
  const room = await loadRoom(codeStr);
  if (!room) return { error: "Room not found", status: 404 };
  if (room.status !== "playing") {
    return { error: "Game not in play", status: 409 };
  }
  const player = room.players[playerToken];
  if (!player) return { error: "Not in this room", status: 403 };
  if (!draft) return { error: "Missing draft", status: 400 };
  if (room.submitted[player.seatId]) {
    return { error: "Already submitted this quarter", status: 409 };
  }

  const check = validateMpSubmission(room.snapshot, player.seatId, draft, {
    envoys: opts.envoys,
    ultimatums: opts.ultimatums,
  });
  if (!check.ok) {
    return { error: check.error || "Invalid bill", status: 400, cost: check.cost };
  }

  if (!room.snapshot.politics) room.snapshot.politics = {};
  if (!room.snapshot.politics[player.seatId]) {
    room.snapshot.politics[player.seatId] = {
      capital: 42,
      country: player.name,
    };
  }
  const pol = room.snapshot.politics[player.seatId];
  if (opts.rateManual != null) pol.rateManual = !!opts.rateManual;
  if (opts.manualRate != null && Number.isFinite(+opts.manualRate)) {
    pol.manualRate = +opts.manualRate;
  }
  if (opts.sandbox != null) pol.sandbox = !!opts.sandbox;

  room.submitted[player.seatId] = {
    draft,
    name: player.name,
    cost: check.cost,
    diploCost: check.diploCost || 0,
    envoys: check.envoys,
    ultimatums: check.ultimatums,
    rateManual: !!pol.rateManual,
    manualRate: pol.manualRate,
    sandbox: !!pol.sandbox,
  };
  room.version += 1;

  const humans = Object.values(room.players).map((p) => p.seatId);
  const allIn = humans.every((id) => room.submitted[id]);
  if (allIn) {
    try {
      resolveLockstepQuarter(room.snapshot, humans, room.submitted);
      room.submitted = {};
      room.version += 1;
    } catch (err) {
      delete room.submitted[player.seatId];
      room.version += 1;
      await saveRoom(room);
      return {
        error: err.message || "Resolve failed",
        status: 500,
      };
    }
  }

  await saveRoom(room);
  return {
    room: publicRoom(room, playerToken),
    resolved: allIn,
  };
}

/** Apply a pending event choice for the calling seat. */
export async function chooseEvent(codeStr, playerToken, body = {}) {
  const room = await loadRoom(codeStr);
  if (!room) return { error: "Room not found", status: 404 };
  if (room.status !== "playing") {
    return { error: "Game not in play", status: 409 };
  }
  const player = room.players[playerToken];
  if (!player) return { error: "Not in this room", status: 403 };
  if (!room.snapshot) return { error: "No snapshot", status: 409 };

  const pol =
    room.snapshot.politics && room.snapshot.politics[player.seatId];
  if (!pol || !pol.pendingEvent) {
    return { error: "No pending event", status: 409 };
  }

  if (body.dismiss) {
    pol.pendingEvent = null;
    /* If a summit visit queued more events, promote the next one. */
    if (Array.isArray(pol.missionEvents) && pol.missionEvents.length) {
      const item = pol.missionEvents.shift();
      if (item) {
        pol.pendingEvent = {
          missionEvent: true,
          partnerId: item.partnerId,
          missionId: item.missionId || "summit",
          eventIndex: item.eventIndex != null ? item.eventIndex : 0,
          q: item.q,
        };
      }
    }
    room.version += 1;
    await saveRoom(room);
    return { room: publicRoom(room, playerToken), ok: true };
  }

  const result = applyMpEventChoice(
    room.snapshot,
    player.seatId,
    body.optionIndex
  );
  if (!result.ok) {
    return { error: result.error || "Event failed", status: 400 };
  }

  room.version += 1;
  await saveRoom(room);
  return { room: publicRoom(room, playerToken), ok: true };
}
