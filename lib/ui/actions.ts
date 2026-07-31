import {
  getG,
  bump,
  syncServiceHolds,
  clamp,
  playerCountryId,
  RATE_FLOOR,
  serviceScore,
  spendForScore,
  TAX_BY_ID,
  countryBlocId,
  withdrawBlocAccession,
  syncTariffHeadline,
  ensureTariffSchedule,
  toggleBlocInvite,
  isVisitActive,
  assignEnvoy,
  recallEnvoy,
  issueUltimatum,
  hideDespatchShell,
  CUSTOM_BLOC_TEMPLATES,
} from "../sim/engine.ts";

const TRANSFER_DEPTS: Record<string, number> = { welfare: 1 };

export function notifyUi() {
  bump();
}

export function setDraftSpend(deptId: string, value: number) {
  const G = getG();
  G.draft.spend[deptId] = value;
  if ((G.draft.mode || {})[deptId] === "service" && !TRANSFER_DEPTS[deptId]) {
    if (!G.draft.hold) G.draft.hold = {};
    G.draft.hold[deptId] = serviceScore(deptId, G.draft, G.econ);
  }
  syncServiceHolds(G.draft, G.econ);
  bump();
}

export function setDraftSpendMode(deptId: string, mode: string) {
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

export function setDraftTaxRate(taxId: string, value: number) {
  const G = getG();
  G.draft.taxes[taxId].rate = value;
  bump();
}

export function setDraftRegime(regimeId: string) {
  const G = getG();
  G.draft.regime = regimeId;
  bump();
}

export function introduceTax(taxId: string) {
  const G = getG();
  const t = TAX_BY_ID[taxId];
  const s = G.draft.taxes[t.id];
  s.on = true;
  if (!(s.rate > 0)) {
    s.rate = t.def > 0 ? t.def : t.step ? t.step * 5 : Math.round(t.max * 0.2);
  }
  bump();
}

export function abolishTax(taxId: string) {
  const G = getG();
  G.draft.taxes[taxId].on = false;
  bump();
}

export function setIncomeOn(on: boolean) {
  const G = getG();
  G.draft.income.on = on;
  bump();
}

export function setNiOn(key: "empOn" | "erOn", on: boolean) {
  const G = getG();
  G.draft.ni[key] = on;
  bump();
}

export function setIncomeAllowance(value: number) {
  const G = getG();
  G.draft.income.allowance = value;
  G.draft.income.bands[0].from = value;
  bump();
}

export function setIncomeField(
  key: "divRate" | "saveRate" | "capitalRate",
  value: number,
) {
  const G = getG();
  G.draft.income[key] = value;
  bump();
}

export function setIncomeUprate(uprate: boolean) {
  const G = getG();
  G.draft.income.uprate = uprate;
  bump();
}

export function setIncomeBandField(
  i: number,
  field: "from" | "rate",
  value: number,
) {
  const G = getG();
  G.draft.income.bands[i][field] = value;
  bump();
}

export function addIncomeBand() {
  const G = getG();
  const bands = G.draft.income.bands;
  const last = bands[bands.length - 1];
  bands.push({
    from: Math.round((last.from * 1.8) / 1000) * 1000 + 20000,
    rate: Math.min(90, last.rate + 5),
  });
  bump();
}

export function delIncomeBand(i: number) {
  const G = getG();
  G.draft.income.bands.splice(i, 1);
  bump();
}

export function setNiRate(key: "empRate" | "erRate", value: number) {
  const G = getG();
  G.draft.ni[key] = value;
  bump();
}

export function toggleDraftDeal(dealId: string) {
  const G = getG();
  if (G.draft.deals[dealId]) delete G.draft.deals[dealId];
  else G.draft.deals[dealId] = true;
  bump();
}

export function toggleBlocExternalDeal(dealId: string, partnerId: string) {
  const G = getG();
  if (
    G.draft.blocExternalDeal &&
    G.draft.blocExternalDeal.dealId === dealId &&
    G.draft.blocExternalDeal.partnerId === partnerId
  ) {
    G.draft.blocExternalDeal = null;
  } else {
    G.draft.blocExternalDeal = { partnerId, dealId };
  }
  bump();
}

export function toggleBlocAccession(
  blocId: string,
  blocJoinBlockersLen: number,
) {
  const G = getG();
  const phase = "apply";
  if (
    G.draft.blocAccession &&
    G.draft.blocAccession.blocId === blocId &&
    G.draft.blocAccession.phase === phase
  ) {
    G.draft.blocAccession = null;
  } else {
    if (blocJoinBlockersLen > 0) return;
    G.draft.blocCreate = null;
    G.draft.blocAccession = { blocId, phase };
  }
  bump();
}

export function withdrawBlocAccessionDraft() {
  const G = getG();
  if (G.mp && typeof G.mp.onDiploAction === "function") {
    const r = G.mp.onDiploAction({ action: "withdrawBlocAccession" });
    if (r && r.ok === false) {
      if (r.error) alert(r.error);
      return;
    }
  } else {
    withdrawBlocAccession(G);
  }
  bump();
}

export function toggleBlocLeave() {
  const G = getG();
  G.draft.blocLeave = !G.draft.blocLeave;
  bump();
}

export function unstageBlocCreate() {
  const G = getG();
  G.draft.blocCreate = null;
  bump();
}

export function setTariffLever(key: string, value: number) {
  const G = getG();
  ensureTariffSchedule(G.draft);
  if (key === "tariffDefault") G.draft.tariffSchedule.default = value;
  else if (key === "tariffCet") G.draft.tariffSchedule.cet = value;
  else if (key.startsWith("tariffBloc:"))
    G.draft.tariffSchedule.bloc[key.slice(11)] = value;
  else if (key.startsWith("tariffCountry:"))
    G.draft.tariffSchedule.country[key.slice(14)] = value;
  syncTariffHeadline(G.draft);
  bump();
}

export function playerInBlocId(): string | null {
  return countryBlocId(playerCountryId());
}

export function toggleBlocInviteDraft(candidateId: string) {
  toggleBlocInvite(candidateId);
  bump();
}

export function confirmBlocFound(name: string, templateId: string) {
  const G = getG();
  const tpl = (CUSTOM_BLOC_TEMPLATES as any)[templateId];
  const trimmed = (name || "").trim().slice(0, 34);
  G.draft.blocAccession = null;
  G.draft.blocCreate = {
    name: trimmed || (tpl ? tpl.name : "Trade bloc"),
    template: templateId,
  };
  hideDespatchShell();
  bump();
}

export function confirmBlocInvite(candidateId: string) {
  toggleBlocInvite(candidateId);
  hideDespatchShell();
  bump();
}

export function toggleMission(partnerId: string, missionId: string) {
  const G = getG();
  const already = G.draft.missions[partnerId] === missionId;
  if (
    !already &&
    missionId === "sanctionsPosture" &&
    isVisitActive(G, partnerId)
  )
    return;
  if (already) delete G.draft.missions[partnerId];
  else G.draft.missions[partnerId] = missionId;
  bump();
}

export function assignEnvoyAction(partnerId: string) {
  const G = getG();
  if (G.mp && typeof G.mp.onDiploAction === "function") {
    Promise.resolve(G.mp.onDiploAction({ action: "assignEnvoy", partnerId }));
    return;
  }
  if (assignEnvoy(partnerId)) bump();
}

export function recallEnvoyAction(partnerId: string) {
  const G = getG();
  if (G.mp && typeof G.mp.onDiploAction === "function") {
    Promise.resolve(G.mp.onDiploAction({ action: "recallEnvoy", partnerId }));
    return;
  }
  if (recallEnvoy(partnerId)) bump();
}

export function issueUltimatumAction(
  partnerId: string,
  demandId: string | null,
) {
  const G = getG();
  if (G.mp && typeof G.mp.onDiploAction === "function") {
    Promise.resolve(
      G.mp.onDiploAction({ action: "issueUltimatum", partnerId, demandId }),
    );
    return;
  }
  if (issueUltimatum(partnerId, demandId)) bump();
}

export function setSandboxMode(sandbox: boolean) {
  const G = getG();
  G.sandbox = sandbox;
  const sid = playerCountryId();
  if (G.politics && G.politics[sid]) G.politics[sid].sandbox = sandbox;
  bump();
}

export function setRateManual(manual: boolean) {
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

export function setManualRate(value: number, min: number) {
  const G = getG();
  G.manualRate = clamp(value, min, 20);
  G.econ.rate = G.manualRate;
  G.econ.atBound = G.econ.rate <= RATE_FLOOR + 0.02;
  const sid = playerCountryId();
  if (G.politics && G.politics[sid]) G.politics[sid].manualRate = G.manualRate;
  bump();
}

export function setCountryName(name: string) {
  const G = getG();
  G.country = (name || "").trim() || "United Kingdom";
  bump();
}
