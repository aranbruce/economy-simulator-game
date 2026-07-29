/**
 * Multiplayer start + lockstep submit — loads the sim engine.
 * Kept separate from roomStore so create/join APIs stay lightweight.
 */
import {
  resolveLockstepQuarter,
  seedMpPolitics,
  validateMpSubmission,
  applyMpEventChoice,
  applyMpDiploAction,
  applyMpInboundUltimatumChoice,
  applyMpInboundBlocInviteChoice,
  applyMpInboundDealChoice,
} from "../sim/engine.js";
import { publicRoom } from "./roomStore.js";
import { loadRoom, saveRoomCas } from "./roomPersist.js";

const CONFLICT = { error: "Room changed — try again", status: 409 };

async function commitRoom(room, baseVersion) {
  const ok = await saveRoomCas(room, baseVersion);
  return ok ? null : CONFLICT;
}

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
  const baseVer = room.version;
  const humans = Object.values(room.players).map((p) => ({
    seatId: p.seatId,
    role: p.role,
    name: p.name,
  }));
  seedMpPolitics(snapshot, humans);
  room.snapshot = snapshot;
  room.status = "playing";
  room.submitted = {};
  room.version = baseVer + 1;
  const conflict = await commitRoom(room, baseVer);
  if (conflict) return conflict;
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

  const baseVer = room.version;
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
  room.version = baseVer + 1;

  const humans = Object.values(room.players).map((p) => p.seatId);
  const allIn = humans.every((id) => room.submitted[id]);
  if (allIn) {
    try {
      resolveLockstepQuarter(room.snapshot, humans, room.submitted);
      room.submitted = {};
      room.version = baseVer + 2;
    } catch (err) {
      delete room.submitted[player.seatId];
      room.version = baseVer + 1;
      const conflict = await commitRoom(room, baseVer);
      if (conflict) return conflict;
      return {
        error: err.message || "Resolve failed",
        status: 500,
      };
    }
  }

  const conflict = await commitRoom(room, baseVer);
  if (conflict) return conflict;
  return {
    room: publicRoom(room, playerToken),
    resolved: allIn,
  };
}

/**
 * Immediate envoy / ultimatum commit (before Deliver). Capital is charged once
 * on the seat politics bag; Deliver then sees zero diplo delta for those items.
 */
export async function applyDiploAction(codeStr, playerToken, body = {}) {
  const room = await loadRoom(codeStr);
  if (!room) return { error: "Room not found", status: 404 };
  if (room.status !== "playing") {
    return { error: "Game not in play", status: 409 };
  }
  const player = room.players[playerToken];
  if (!player) return { error: "Not in this room", status: 403 };
  if (!room.snapshot) return { error: "No snapshot", status: 409 };
  const action = body.action;
  if (!action) return { error: "Missing action", status: 400 };

  const baseVer = room.version;
  if (!room.snapshot.politics) room.snapshot.politics = {};
  if (!room.snapshot.politics[player.seatId]) {
    room.snapshot.politics[player.seatId] = {
      capital: 42,
      country: player.name,
    };
  }
  const result = applyMpDiploAction(room.snapshot, player.seatId, action, {
    partnerId: body.partnerId,
    demandId: body.demandId,
  });
  if (!result.ok) {
    return { error: result.error || "Diplo action failed", status: 400 };
  }
  /* Withdraw only after a successful diplo mutate, in the same CAS write. */
  let withdrew = false;
  if (room.submitted[player.seatId]) {
    delete room.submitted[player.seatId];
    withdrew = true;
  }
  room.version = baseVer + 1;
  const conflict = await commitRoom(room, baseVer);
  if (conflict) return conflict;
  return {
    room: publicRoom(room, playerToken),
    ok: true,
    withdrew,
    patch: {
      capital: result.capital,
      fac: result.fac,
      envoys: result.envoys,
      ultimatums: result.ultimatums,
      rel: result.rel,
      blocAccessionCleared: !!result.blocAccessionCleared,
    },
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

  /* Inbound human ultimatum — concede / defy, no issuer-side RNG. */
  if (body.inboundUltimatum) {
    if (!pol) return { error: "No seat politics", status: 409 };
    const fromId = body.fromId;
    if (!fromId) return { error: "Missing issuer", status: 400 };
    const inbound = pol.inboundUltimatums && pol.inboundUltimatums[fromId];
    if (!inbound || inbound.status !== "pending") {
      return { error: "No pending inbound ultimatum", status: 409 };
    }
    const baseVer = room.version;
    const result = applyMpInboundUltimatumChoice(
      room.snapshot,
      player.seatId,
      fromId,
      !!body.concede
    );
    if (!result.ok) {
      return { error: result.error || "Ultimatum response failed", status: 400 };
    }
    room.version = baseVer + 1;
    const conflict = await commitRoom(room, baseVer);
    if (conflict) return conflict;
    return { room: publicRoom(room, playerToken), ok: true };
  }

  /* Inbound bloc invitation — accept / decline. */
  if (body.inboundBlocInvite) {
    if (!pol) return { error: "No seat politics", status: 409 };
    const inbound = pol.inboundBlocInvite;
    if (!inbound || inbound.status !== "pending") {
      return { error: "No pending bloc invitation", status: 409 };
    }
    const baseVer = room.version;
    const result = applyMpInboundBlocInviteChoice(
      room.snapshot,
      player.seatId,
      !!body.accept
    );
    if (!result.ok) {
      return { error: result.error || "Bloc invite response failed", status: 400 };
    }
    room.version = baseVer + 1;
    const conflict = await commitRoom(room, baseVer);
    if (conflict) return conflict;
    return { room: publicRoom(room, playerToken), ok: true };
  }

  /* Inbound trade-deal proposal — accept / decline (proposer-only). */
  if (body.inboundDealProposal) {
    if (!pol) return { error: "No seat politics", status: 409 };
    const inbound = pol.inboundDealProposal;
    if (!inbound || inbound.status !== "pending") {
      return { error: "No pending deal proposal", status: 409 };
    }
    const baseVer = room.version;
    const result = applyMpInboundDealChoice(
      room.snapshot,
      player.seatId,
      !!body.accept
    );
    if (!result.ok) {
      return { error: result.error || "Deal response failed", status: 400 };
    }
    room.version = baseVer + 1;
    const conflict = await commitRoom(room, baseVer);
    if (conflict) return conflict;
    return { room: publicRoom(room, playerToken), ok: true };
  }

  if (!pol || !pol.pendingEvent) {
    return { error: "No pending event", status: 409 };
  }

  const baseVer = room.version;
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
    room.version = baseVer + 1;
    const conflict = await commitRoom(room, baseVer);
    if (conflict) return conflict;
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

  room.version = baseVer + 1;
  const conflict = await commitRoom(room, baseVer);
  if (conflict) return conflict;
  return { room: publicRoom(room, playerToken), ok: true };
}
