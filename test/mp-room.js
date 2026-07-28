/**
 * Multiplayer room lockstep — capital gate, politics, briefing inputs, leave.
 */
import assert from "node:assert/strict";
import {
  newGame,
  getG,
  exportGameSnapshot,
  hydrateGameSnapshot,
  resolveLockstepQuarter,
  clone,
  playerCountryId,
  validateMpSubmission,
  applyMpEventChoice,
  EVENTS,
} from "../lib/sim/engine.js";
import {
  createRoom,
  joinRoom,
  unsubmitBill,
  getRoom,
  leaveRoom,
  _resetRoomsForTests,
} from "../lib/mp/roomStore.js";
import { startRoom, submitBill, chooseEvent } from "../lib/mp/roomPlay.js";

async function main() {
  _resetRoomsForTests();

  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snap0 = exportGameSnapshot(getG());
  assert.ok(snap0.world, "snapshot has world");
  assert.equal(snap0.q, 0);
  assert.equal(snap0.sandbox, false, "solo newGame defaults sandbox off");

  const host = await createRoom({ hostName: "Alice", role: "home" });
  assert.equal(host.room.status, "lobby");
  assert.equal(host.room.humanCount, 1);

  const guest = await joinRoom(host.room.code, { name: "Bob", role: "germany" });
  assert.ok(!guest.error, guest.error);
  assert.equal(guest.room.humanCount, 2);

  const started = await startRoom(host.room.code, host.token, snap0);
  assert.ok(!started.error, started.error);
  assert.equal(started.room.status, "playing");
  assert.ok(started.room.snapshot.politics.kingdom, "host politics seeded");
  assert.ok(started.room.snapshot.politics.germany, "guest politics seeded");
  assert.equal(started.room.snapshot.politics.kingdom.capital, 42);
  assert.equal(
    started.room.snapshot.politics.kingdom.sandbox,
    false,
    "sandbox off by default for MP seats"
  );
  assert.equal(
    started.room.snapshot.politics.germany.sandbox,
    false,
    "guest sandbox off by default"
  );

  const facBefore = clone(started.room.snapshot.politics.germany.fac);

  const early = await submitBill(
    host.room.code,
    host.token,
    clone(started.room.snapshot.world.kingdom.law)
  );
  assert.ok(!early.error, early.error);
  assert.equal(early.resolved, false);
  assert.equal(early.room.you.submitted, true);

  const withdrawn = await unsubmitBill(host.room.code, host.token);
  assert.ok(!withdrawn.error, withdrawn.error);
  assert.equal(withdrawn.withdrawn, true);
  assert.equal(withdrawn.room.you.submitted, false);
  assert.equal(withdrawn.room.submittedCount, 0, "withdraw clears waiting queue");

  const early2 = await submitBill(
    host.room.code,
    host.token,
    clone(started.room.snapshot.world.kingdom.law)
  );
  assert.ok(!early2.error, early2.error);
  assert.equal(early2.resolved, false);

  const draftB = clone(started.room.snapshot.world.germany.law);
  draftB.taxes = draftB.taxes || {};
  if (draftB.taxes.vat) draftB.taxes.vat.rate = (draftB.taxes.vat.rate || 20) + 1;

  const last = await submitBill(host.room.code, guest.token, draftB);
  assert.ok(!last.error, last.error);
  assert.equal(last.resolved, true, "quarter resolves when all humans submit");
  assert.equal(last.room.q, 1, "quarter advanced");
  assert.ok(last.room.snapshot.politics.germany.lastRes, "lastRes stored");
  assert.ok(
    last.room.snapshot.politics.germany.lastRes.E,
    "lastRes has aggregate E"
  );

  const facAfter = last.room.snapshot.politics.germany.fac;
  assert.notDeepEqual(
    facAfter,
    facBefore,
    "human faction scores move after lockstep politics"
  );

  hydrateGameSnapshot(last.room.snapshot, {
    homeRole: "germany",
    country: "Bob",
    render: false,
  });
  const g = getG();
  assert.equal(g.q, 1);
  assert.equal(g.sandbox, false, "hydrate remounts career (sandbox off)");
  assert.equal(playerCountryId(g.homeRole), "germany");
  assert.equal(g.capital, last.room.snapshot.politics.germany.capital);
  assert.ok(g.log.length >= 1, "guest has own quarter log");
  assert.equal(
    g.log[g.log.length - 1].growth,
    g.econ._lastGrowth,
    "guest top-bar Growth matches own econ, not host log"
  );
  assert.equal(
    g.log[g.log.length - 1].debt,
    g.econ.debt,
    "guest top-bar Debt series matches own econ"
  );

  /* Sandbox persists across submit / resolve when toggled on. */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapSb = exportGameSnapshot(getG());
  const hSb = await createRoom({ hostName: "Alice", role: "home" });
  const gSb = await joinRoom(hSb.room.code, { name: "Bob", role: "germany" });
  const stSb = await startRoom(hSb.room.code, hSb.token, snapSb);
  assert.ok(!stSb.error, stSb.error);
  await submitBill(
    hSb.room.code,
    hSb.token,
    clone(stSb.room.snapshot.world.kingdom.law),
    { sandbox: true }
  );
  const lastSb = await submitBill(
    hSb.room.code,
    gSb.token,
    clone(stSb.room.snapshot.world.germany.law),
    { sandbox: false }
  );
  assert.ok(!lastSb.error, lastSb.error);
  assert.equal(lastSb.resolved, true);
  assert.equal(
    lastSb.room.snapshot.politics.kingdom.sandbox,
    true,
    "host sandbox persists after resolve"
  );
  assert.equal(
    lastSb.room.snapshot.politics.germany.sandbox,
    false,
    "guest sandbox stays off"
  );
  hydrateGameSnapshot(lastSb.room.snapshot, {
    homeRole: "home",
    country: "Alice",
    render: false,
  });
  assert.equal(getG().sandbox, true, "hydrate remounts persisted sandbox");

  /* Forced pending event applies via chooseEvent. */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapEv = exportGameSnapshot(getG());
  const hEv = await createRoom({ hostName: "Alice", role: "home" });
  const gEv = await joinRoom(hEv.room.code, { name: "Bob", role: "germany" });
  const stEv = await startRoom(hEv.room.code, hEv.token, snapEv);
  assert.ok(!stEv.error, stEv.error);
  hydrateGameSnapshot(stEv.room.snapshot, {
    homeRole: "germany",
    country: "Bob",
    render: false,
  });
  const sampleEv = EVENTS.find(
    (e) => !e.major && e.opts && e.opts.length && (!e.cond || e.cond()) && !e.resolve
  );
  assert.ok(sampleEv, "have an ordinary event that prepares cleanly");
  stEv.room.snapshot.politics.germany.pendingEvent = {
    id: sampleEv.id,
    isMajor: false,
  };
  const chosen = await chooseEvent(hEv.room.code, gEv.token, { optionIndex: 0 });
  assert.ok(!chosen.error, chosen.error);
  assert.equal(
    chosen.room.snapshot.politics.germany.pendingEvent,
    null,
    "pending event cleared after choice"
  );
  const snapForce = clone(stEv.room.snapshot);
  snapForce.politics.germany.pendingEvent = { id: sampleEv.id, isMajor: false };
  assert.ok(
    applyMpEventChoice(snapForce, "germany", 0).ok,
    "applyMpEventChoice succeeds on forced event"
  );

  /* Capital gate rejects unaffordable bills. */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapGate = exportGameSnapshot(getG());
  const h2 = await createRoom({ hostName: "Alice", role: "home" });
  await joinRoom(h2.room.code, { name: "Bob", role: "germany" });
  const st2 = await startRoom(h2.room.code, h2.token, snapGate);
  st2.room.snapshot.politics.kingdom.capital = 0;
  const pricey = clone(st2.room.snapshot.world.kingdom.law);
  pricey.taxes.vat.rate = (pricey.taxes.vat.rate || 20) + 5;
  const denied = validateMpSubmission(st2.room.snapshot, "kingdom", pricey);
  assert.equal(denied.ok, false, "validation fails when capital is 0");
  const deniedSubmit = await submitBill(h2.room.code, h2.token, pricey);
  assert.ok(deniedSubmit.error, "submit rejects unaffordable bill");
  assert.match(deniedSubmit.error, /capital/i);

  /* Host leave deletes the room. */
  _resetRoomsForTests();
  const h3 = await createRoom({ hostName: "Alice", role: "home" });
  await joinRoom(h3.room.code, { name: "Bob", role: "germany" });
  const left = await leaveRoom(h3.room.code, h3.token);
  assert.equal(left.ok, true);
  assert.equal(left.deleted, true);
  assert.equal(await getRoom(h3.room.code, h3.token), null, "room gone after host leave");

  /* Direct resolve helper keeps AI seats moving. */
  const snap1 = exportGameSnapshot(g);
  const qBefore = snap1.q;
  resolveLockstepQuarter(snap1, ["germany"], {
    germany: { draft: clone(snap1.world.germany.law) },
  });
  assert.equal(snap1.q, qBefore + 1);
  assert.ok(
    Math.abs(snap1.econ.debt - snap1.world.germany.econ.debt) < 1e-9,
    "top-level snap.econ tracks lead seat after resolve (not frozen opening)"
  );

  /* ---- Diplomacy seat isolation ---- */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapDiplo = exportGameSnapshot(getG());
  const hDiplo = await createRoom({ hostName: "Alice", role: "home" });
  const gDiplo = await joinRoom(hDiplo.room.code, { name: "Bob", role: "germany" });
  const stDiplo = await startRoom(hDiplo.room.code, hDiplo.token, snapDiplo);
  assert.ok(!stDiplo.error, stDiplo.error);

  /* Seed empty diplo politics explicitly for clarity. */
  assert.ok(
    Array.isArray(stDiplo.room.snapshot.politics.kingdom.envoys),
    "host politics seed envoys"
  );
  assert.ok(
    Array.isArray(stDiplo.room.snapshot.politics.germany.envoys),
    "guest politics seed envoys"
  );

  const hostDraft = clone(stDiplo.room.snapshot.world.kingdom.law);
  hostDraft.missions = { france: "summit" };
  const guestDraft = clone(stDiplo.room.snapshot.world.germany.law);
  guestDraft.missions = { japan: "sanctionsPosture" };

  const hostEnv = [null, null];
  hostEnv[0] = "france";
  const guestEnv = [null, null];
  guestEnv[0] = "japan";

  const hostUlt = {
    russia: {
      demand: "tariff_cut",
      label: "Cut tariffs",
      sentQ: 0,
      expiresQ: 2,
      status: "pending",
    },
  };

  await submitBill(hDiplo.room.code, hDiplo.token, hostDraft, {
    envoys: hostEnv,
    ultimatums: hostUlt,
  });
  const diploResolved = await submitBill(gDiplo.room.code, gDiplo.token, guestDraft, {
    envoys: guestEnv,
    ultimatums: {},
  });
  assert.ok(!diploResolved.error, diploResolved.error);
  assert.equal(diploResolved.resolved, true, "diplo quarter resolves");

  const polK = diploResolved.room.snapshot.politics.kingdom;
  const polG = diploResolved.room.snapshot.politics.germany;

  assert.ok(polK.envoys.includes("france"), "host keeps france envoy");
  assert.ok(!polK.envoys.includes("japan"), "host does not inherit guest envoy");
  assert.ok(polG.envoys.includes("japan"), "guest keeps japan envoy");
  assert.ok(!polG.envoys.includes("france"), "guest does not inherit host envoy");

  assert.ok(
    polK.activeVisits && polK.activeVisits.france,
    "host summit creates host-only active visit"
  );
  assert.ok(
    !polG.activeVisits || !polG.activeVisits.france,
    "guest does not see host's france visit"
  );
  assert.ok(
    polK.ultimatums && polK.ultimatums.russia,
    "host ultimatum stays on host politics"
  );
  assert.ok(
    !polG.ultimatums || !polG.ultimatums.russia,
    "guest does not see host ultimatum"
  );

  /* Capital charged for envoy (+ summit is a bill clause). */
  assert.ok(
    polK.capital < 42,
    "host capital spent on bill and/or envoy"
  );

  /* Hydrate each seat — remounted diplo must not cross. */
  hydrateGameSnapshot(diploResolved.room.snapshot, {
    homeRole: "home",
    seatId: "kingdom",
    country: "Alice",
    render: false,
  });
  const gHost = getG();
  assert.ok(gHost.envoys.includes("france"), "hydrate host remounts france envoy");
  assert.ok(!gHost.envoys.includes("japan"), "hydrate host has no japan envoy");
  assert.ok(gHost.activeVisits.france, "hydrate host remounts france visit");
  assert.ok(gHost.ultimatums.russia, "hydrate host remounts russia ultimatum");

  hydrateGameSnapshot(diploResolved.room.snapshot, {
    homeRole: "germany",
    seatId: "germany",
    country: "Bob",
    render: false,
  });
  const gGuest = getG();
  assert.ok(gGuest.envoys.includes("japan"), "hydrate guest remounts japan envoy");
  assert.ok(!gGuest.envoys.includes("france"), "hydrate guest has no france envoy");
  assert.ok(
    !gGuest.activeVisits || !gGuest.activeVisits.france,
    "hydrate guest has no host visit"
  );
  assert.ok(
    !gGuest.ultimatums || !gGuest.ultimatums.russia,
    "hydrate guest has no host ultimatum"
  );

  /* Host summit does not block guest sanctions against the same partner. */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapVis = exportGameSnapshot(getG());
  const hVis = await createRoom({ hostName: "Alice", role: "home" });
  const gVis = await joinRoom(hVis.room.code, { name: "Bob", role: "united_states" });
  const stVis = await startRoom(hVis.room.code, hVis.token, snapVis);
  assert.ok(!stVis.error, stVis.error);

  const draftVisHost = clone(stVis.room.snapshot.world.kingdom.law);
  draftVisHost.missions = { china: "summit" };
  const draftVisGuest = clone(stVis.room.snapshot.world.united_states.law);
  draftVisGuest.missions = {};

  await submitBill(hVis.room.code, hVis.token, draftVisHost, { envoys: [null, null] });
  const visQ1 = await submitBill(gVis.room.code, gVis.token, draftVisGuest, {
    envoys: [null, null],
  });
  assert.ok(!visQ1.error, visQ1.error);
  assert.ok(
    visQ1.room.snapshot.politics.kingdom.activeVisits.china,
    "host china visit live after Q1"
  );

  /* Guest stages sanctions vs china while host visit is live — must apply. */
  const draftSanHost = clone(visQ1.room.snapshot.world.kingdom.law);
  draftSanHost.missions = {};
  const draftSanGuest = clone(visQ1.room.snapshot.world.united_states.law);
  draftSanGuest.missions = { china: "sanctionsPosture" };

  await submitBill(hVis.room.code, hVis.token, draftSanHost, {
    envoys: visQ1.room.snapshot.politics.kingdom.envoys,
  });
  const visQ2 = await submitBill(gVis.room.code, gVis.token, draftSanGuest, {
    envoys: visQ1.room.snapshot.politics.united_states.envoys,
  });
  assert.ok(!visQ2.error, visQ2.error);
  const usEcon = visQ2.room.snapshot.world.united_states.econ;
  assert.ok(
    usEcon.relImpulse && (usEcon.relImpulse.china || 0) < 0,
    "guest sanctions vs china apply despite host's china visit"
  );
  assert.ok(
    !visQ2.room.snapshot.politics.united_states.activeVisits ||
      !visQ2.room.snapshot.politics.united_states.activeVisits.china,
    "guest has no china visit of their own"
  );

  /* Summit mission event lands only on the enacting seat's pendingEvent. */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapSum = exportGameSnapshot(getG());
  const hSum = await createRoom({ hostName: "Alice", role: "home" });
  const gSum = await joinRoom(hSum.room.code, { name: "Bob", role: "germany" });
  const stSum = await startRoom(hSum.room.code, hSum.token, snapSum);
  const draftSumHost = clone(stSum.room.snapshot.world.kingdom.law);
  draftSumHost.missions = { france: "summit" };
  const draftSumGuest = clone(stSum.room.snapshot.world.germany.law);
  draftSumGuest.missions = {};
  await submitBill(hSum.room.code, hSum.token, draftSumHost, { envoys: [null, null] });
  const sumRes = await submitBill(gSum.room.code, gSum.token, draftSumGuest, {
    envoys: [null, null],
  });
  assert.ok(!sumRes.error, sumRes.error);
  const hostPending = sumRes.room.snapshot.politics.kingdom.pendingEvent;
  const guestPending = sumRes.room.snapshot.politics.germany.pendingEvent;
  assert.ok(
    hostPending && hostPending.missionEvent && hostPending.partnerId === "france",
    "host gets summit mission pendingEvent for france"
  );
  assert.ok(
    !guestPending || !guestPending.missionEvent || guestPending.partnerId !== "france",
    "guest does not get host's france summit mission event"
  );

  /* Ultimatum resolves in lockstep and leaves a per-seat diploAlert. */
  _resetRoomsForTests();
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const snapUlt = exportGameSnapshot(getG());
  const hUlt = await createRoom({ hostName: "Alice", role: "home" });
  const gUlt = await joinRoom(hUlt.room.code, { name: "Bob", role: "germany" });
  const stUlt = await startRoom(hUlt.room.code, hUlt.token, snapUlt);
  const qUlt = stUlt.room.snapshot.q;
  await submitBill(hUlt.room.code, hUlt.token, clone(stUlt.room.snapshot.world.kingdom.law), {
    envoys: [null, null],
    ultimatums: {},
  });
  const ultRes = await submitBill(
    hUlt.room.code,
    gUlt.token,
    clone(stUlt.room.snapshot.world.germany.law),
    {
      envoys: [null, null],
      ultimatums: {
        france: {
          demand: "tariffCut",
          label: "Cut tariffs on our exports",
          sentQ: qUlt,
          expiresQ: qUlt + 1,
          status: "pending",
        },
      },
    }
  );
  assert.ok(!ultRes.error, ultRes.error);
  const gPolUlt = ultRes.room.snapshot.politics.germany;
  const kPolUlt = ultRes.room.snapshot.politics.kingdom;
  assert.ok(
    !(gPolUlt.ultimatums && gPolUlt.ultimatums.france),
    "guest ultimatum clears after resolve"
  );
  assert.ok(
    (gPolUlt.diploAlerts || []).some(
      (a) => a.partnerId === "france" && (a.kind === "ult_defy" || a.kind === "ult_concede")
    ),
    "guest politics gets ultimatum outcome alert"
  );
  assert.ok(
    !(kPolUlt.diploAlerts || []).some((a) => a.partnerId === "france" && a.kind && a.kind.startsWith("ult_")),
    "host does not inherit guest ultimatum alert"
  );

  console.log("mp-room: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
