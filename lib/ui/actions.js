import {
  getG,
  bump,
  syncServiceHolds,
  clamp,
  playerCountryId,
  RATE_FLOOR,
  serviceScore,
  spendForScore,
} from "../sim/engine.js";

const TRANSFER_DEPTS = { welfare: 1 };

export function notifyUi() {
  bump();
}

export function setDraftSpend(deptId, value) {
  const G = getG();
  G.draft.spend[deptId] = value;
  if ((G.draft.mode || {})[deptId] === "service" && !TRANSFER_DEPTS[deptId]) {
    if (!G.draft.hold) G.draft.hold = {};
    G.draft.hold[deptId] = serviceScore(deptId, G.draft, G.econ);
  }
  syncServiceHolds(G.draft, G.econ);
  bump();
}

export function setDraftSpendMode(deptId, mode) {
  const G = getG();
  if (!G.draft.mode) G.draft.mode = {};
  if (!G.draft.hold) G.draft.hold = {};
  if (mode === "share") delete G.draft.mode[deptId];
  else G.draft.mode[deptId] = mode;
  if (mode === "service" && !TRANSFER_DEPTS[deptId]) {
    G.draft.hold[deptId] = serviceScore(deptId, G.draft, G.econ);
    G.draft.spend[deptId] = spendForScore(deptId, G.draft.hold[deptId], G.econ);
  } else {
    delete G.draft.hold[deptId];
  }
  syncServiceHolds(G.draft, G.econ);
  bump();
}

export function setDraftTaxRate(taxId, value) {
  const G = getG();
  G.draft.taxes[taxId].rate = value;
  bump();
}

export function setSandboxMode(sandbox) {
  const G = getG();
  G.sandbox = sandbox;
  const sid = playerCountryId();
  if (G.politics && G.politics[sid]) G.politics[sid].sandbox = sandbox;
  bump();
}

export function setRateManual(manual) {
  const G = getG();
  if (manual && !G.rateManual) {
    G.manualRate = +G.econ.rate.toFixed(2);
    G.econ.rate = G.manualRate;
  }
  G.rateManual = manual;
  const sid = playerCountryId();
  if (G.politics && G.politics[sid]) {
    G.politics[sid].rateManual = manual;
    G.politics[sid].manualRate = G.manualRate;
  }
  bump();
}

export function setManualRate(value, min) {
  const G = getG();
  G.manualRate = clamp(value, min, 20);
  G.econ.rate = G.manualRate;
  G.econ.atBound = G.econ.rate <= RATE_FLOOR + 0.02;
  const sid = playerCountryId();
  if (G.politics && G.politics[sid]) G.politics[sid].manualRate = G.manualRate;
  bump();
}

export function setCountryName(name) {
  const G = getG();
  G.country = (name || "").trim() || "United Kingdom";
  bump();
}
