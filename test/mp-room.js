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


_resetRoomsForTests();

newGame({ country: "Hostland", homeRole: "home", silent: true });
const snap0 = exportGameSnapshot(getG());
assert.ok(snap0.world, "snapshot has world");
assert.equal(snap0.q, 0);
assert.equal(snap0.sandbox, false, "solo newGame defaults sandbox off");

const host = createRoom({ hostName: "Alice", role: "home" });
assert.equal(host.room.status, "lobby");
assert.equal(host.room.humanCount, 1);

const guest = joinRoom(host.room.code, { name: "Bob", role: "germany" });
assert.ok(!guest.error, guest.error);
assert.equal(guest.room.humanCount, 2);

const started = startRoom(host.room.code, host.token, snap0);
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

const early = submitBill(
  host.room.code,
  host.token,
  clone(started.room.snapshot.world.kingdom.law)
);
assert.ok(!early.error, early.error);
assert.equal(early.resolved, false);
assert.equal(early.room.you.submitted, true);

const withdrawn = unsubmitBill(host.room.code, host.token);
assert.ok(!withdrawn.error, withdrawn.error);
assert.equal(withdrawn.withdrawn, true);
assert.equal(withdrawn.room.you.submitted, false);
assert.equal(withdrawn.room.submittedCount, 0, "withdraw clears waiting queue");

const early2 = submitBill(
  host.room.code,
  host.token,
  clone(started.room.snapshot.world.kingdom.law)
);
assert.ok(!early2.error, early2.error);
assert.equal(early2.resolved, false);

const draftB = clone(started.room.snapshot.world.germany.law);
draftB.taxes = draftB.taxes || {};
if (draftB.taxes.vat) draftB.taxes.vat.rate = (draftB.taxes.vat.rate || 20) + 1;

const last = submitBill(host.room.code, guest.token, draftB);
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
const hSb = createRoom({ hostName: "Alice", role: "home" });
const gSb = joinRoom(hSb.room.code, { name: "Bob", role: "germany" });
const stSb = startRoom(hSb.room.code, hSb.token, snapSb);
assert.ok(!stSb.error, stSb.error);
submitBill(
  hSb.room.code,
  hSb.token,
  clone(stSb.room.snapshot.world.kingdom.law),
  { sandbox: true }
);
const lastSb = submitBill(
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
const hEv = createRoom({ hostName: "Alice", role: "home" });
const gEv = joinRoom(hEv.room.code, { name: "Bob", role: "germany" });
const stEv = startRoom(hEv.room.code, hEv.token, snapEv);
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
const chosen = chooseEvent(hEv.room.code, gEv.token, { optionIndex: 0 });
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
const h2 = createRoom({ hostName: "Alice", role: "home" });
joinRoom(h2.room.code, { name: "Bob", role: "germany" });
const st2 = startRoom(h2.room.code, h2.token, snapGate);
st2.room.snapshot.politics.kingdom.capital = 0;
const pricey = clone(st2.room.snapshot.world.kingdom.law);
pricey.taxes.vat.rate = (pricey.taxes.vat.rate || 20) + 5;
const denied = validateMpSubmission(st2.room.snapshot, "kingdom", pricey);
assert.equal(denied.ok, false, "validation fails when capital is 0");
const deniedSubmit = submitBill(h2.room.code, h2.token, pricey);
assert.ok(deniedSubmit.error, "submit rejects unaffordable bill");
assert.match(deniedSubmit.error, /capital/i);

/* Host leave deletes the room. */
_resetRoomsForTests();
const h3 = createRoom({ hostName: "Alice", role: "home" });
joinRoom(h3.room.code, { name: "Bob", role: "germany" });
const left = leaveRoom(h3.room.code, h3.token);
assert.equal(left.ok, true);
assert.equal(left.deleted, true);
assert.equal(getRoom(h3.room.code, h3.token), null, "room gone after host leave");

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

console.log("mp-room: ok");
