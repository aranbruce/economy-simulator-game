/**
 * Single-player resume — exportGameSnapshot/hydrateGameSnapshot's
 * `mode: "solo"` opts, used by lib/sp/save.ts's localStorage round trip.
 * Unlike a lockstep MP remount, a solo reload must keep the mid-bill draft,
 * an unanswered press clip and the open drawer.
 */
import assert from "node:assert/strict";
import {
  newGame,
  getG,
  exportGameSnapshot,
  hydrateGameSnapshot,
  presentEventAsPress,
  pressChoicePending,
  setTab,
  getTab,
  clone,
  EVENTS,
} from "../lib/sim/engine.ts";

function main() {
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const G = getG();

  /* Mid-quarter draft: one tax moved, not enacted. */
  G.draft.taxes = G.draft.taxes || {};
  G.draft.taxes.vat = G.draft.taxes.vat || {};
  const vatBefore = G.draft.taxes.vat.rate || 20;
  G.draft.taxes.vat.rate = vatBefore + 1;
  assert.notEqual(
    G.draft.taxes.vat.rate,
    G.law.taxes.vat.rate,
    "draft has diverged from law before export",
  );

  /* Unanswered Cabinet clip. presentEventAsPress auto-opens the inbox
     (expandPress clears tab), so it must run before the drawer is opened
     below, or the open-drawer assertion would be testing a stale value. */
  const sampleEv = EVENTS.find(
    (e) => !e.major && e.opts && e.opts.length && (!e.cond || e.cond()) && !e.resolve,
  );
  assert.ok(sampleEv, "have an ordinary event that prepares cleanly");
  presentEventAsPress(sampleEv, () => {});
  assert.ok(pressChoicePending(), "clip pending before export");

  /* Open drawer. */
  setTab("taxes");
  assert.equal(getTab(), "taxes", "drawer open before export");

  const qBefore = G.q;
  const capitalBefore = G.capital;
  const draftBefore = clone(G.draft);
  const lawBefore = clone(G.law);
  const worldKeysBefore = Object.keys(G.world || {}).sort();

  const snap = exportGameSnapshot(getG(), { mode: "solo" });
  assert.ok(snap, "solo export produces a snapshot");
  assert.ok(snap.press && snap.press.length, "solo export keeps the press inbox");
  assert.ok(
    snap.press.some((c) => c.pendingChoice),
    "solo export keeps the pending clip specifically",
  );
  assert.equal(snap.tab, "taxes", "solo export keeps the open drawer");
  assert.equal(
    snap.draft.taxes.vat.rate,
    vatBefore + 1,
    "solo export keeps the staged draft",
  );

  /* A plain (MP-shaped) export must still wipe press for a fellow seat's mount. */
  const mpSnap = exportGameSnapshot(getG());
  assert.equal(mpSnap.press.length, 0, "non-solo export still clears press");

  /* Simulate a page reload: nothing carries over except the snapshot. */
  hydrateGameSnapshot(snap, {
    homeRole: "home",
    country: "Hostland",
    mode: "solo",
    render: false,
  });
  const R = getG();

  assert.equal(R.q, qBefore, "solo hydrate restores q");
  assert.equal(R.capital, capitalBefore, "solo hydrate restores capital");
  assert.deepEqual(R.draft, draftBefore, "solo hydrate restores the staged draft");
  assert.deepEqual(R.law, lawBefore, "solo hydrate restores law");
  assert.deepEqual(
    Object.keys(R.world || {}).sort(),
    worldKeysBefore,
    "solo hydrate restores every world seat",
  );
  assert.ok(
    pressChoicePending(),
    "a pending press clip still blocks Deliver after reload",
  );
  assert.equal(getTab(), "taxes", "solo hydrate restores the open drawer");

  /* A plain (MP-shaped) hydrate must still wipe the draft/tab, as before —
     the regression this whole mode: "solo" split guards against. */
  newGame({ country: "Hostland", homeRole: "home", silent: true });
  const G2 = getG();
  G2.draft.taxes.vat.rate = (G2.draft.taxes.vat.rate || 20) + 1;
  setTab("taxes");
  const snapMp = exportGameSnapshot(getG());
  assert.equal(snapMp.press.length, 0, "non-solo export still clears press");
  hydrateGameSnapshot(snapMp, {
    homeRole: "home",
    country: "Hostland",
    render: false,
  });
  const R2 = getG();
  assert.equal(
    R2.draft.taxes.vat.rate,
    R2.law.taxes.vat.rate,
    "non-solo hydrate still wipes the draft back to law",
  );
  assert.equal(getTab(), null, "non-solo hydrate still closes the drawer");

  console.log("sp-save: ok");
}

main();
