/**
 * Learn-by-doing tutorial step definitions and pure helpers.
 * Engine owns setTab / draft reset; this module stays free of G.
 */

interface CoachCtx {
  getTab?: () => string | null;
  q: number;
  startQ: number;
  draft: any;
  law: any;
  rel?: Record<string, number>;
  blocMember?: Record<string, string>;
  blocAccession?: { blocId: string; step?: number } | null;
  blocAccessionByCountry?: Record<string, { blocId: string; step?: number }>;
  homeRole?: string;
  billLen?: number;
}

export function capitalShortfallHint(need: number, have: number) {
  const n = Math.round(need);
  const h = Math.round(have);
  const short = Math.max(0, n - h);
  return (
    "Costs " +
    n +
    " capital; you have " +
    h +
    (short ? " (need " + short + " more)" : "") +
    ". Capital pays for legislation and diplomacy; it rebuilds each quarter (faster with higher approval). Trim the Programme, or wait."
  );
}

interface CoachStepDef {
  id: string;
  title: string;
  body: string;
  task: string | null;
  tab: string | null;
  trackStartQ?: boolean;
  confirmAfter?: boolean;
  reopenTab?: boolean;
}

export const COACH_STEPS: CoachStepDef[] = [
  {
    id: "intro",
    title: "Taking office",
    body: "<p>You’ve just taken the job. Money is tight, the country isn’t growing as fast as you’d like, and your job is to steer things — and leave the place better than you found it.</p><p><b>Top of the screen</b> — how the country is doing right now (growth, prices, the budget gap, debt, how popular you are, and political capital). <b>Bottom of the screen</b> — menus to change things (left), your <b>Programme</b> list (right), and <b>Next quarter</b> to move time forward.</p>",
    task: null,
    tab: null,
  },
  {
    id: "budget",
    title: "Invest in schools",
    body: "<p>Start with schools. More education spending usually makes people happier with you, and over the years it helps the country grow by building skills.</p>",
    task: "Bottom left → Budget → raise Education a bit.",
    tab: "budget",
    confirmAfter: true,
  },
  {
    id: "deficit",
    title: "The bill lands",
    body: "<p>That spending has to be paid for somehow. Look at <b>Balance</b> at the top of the screen — that’s whether you’re taking in more than you spend this year (yours is already in the red). <b>Debt</b> is the pile of borrowing that builds up over time.</p>",
    task: "Bottom right → Programme; check the budget balance line.",
    tab: null,
    confirmAfter: true,
  },
  {
    id: "taxes",
    title: "Pay for it",
    body: "<p>So raise some taxes to help pay for the schools. Put VAT up by 3 points and company tax by 5 — enough that the extra money should more than cover what you spent on education.</p>",
    task: "Bottom left → Taxes → raise VAT and company tax.",
    tab: "taxes",
    confirmAfter: true,
  },
  {
    id: "books",
    title: "Check the books",
    body: "<p>Open your Programme again. The tax rises should have narrowed the red gap compared with schools alone — and the plan should look better for growth over time. It’s all in one place.</p>",
    task: "Bottom right → Programme; look over the plan.",
    tab: null,
    confirmAfter: true,
  },
  {
    id: "policies",
    title: "Skills on the statute book",
    body: "<p>Spending isn’t everything. Turn on the <b>National skills guarantee</b> — a law that funds retraining. It also helps skills and growth, with a small ongoing cost.</p>",
    task: "Bottom left → Policies → turn on National skills guarantee.",
    tab: "policies",
  },
  {
    id: "trade",
    title: "Open for business",
    body: "<p>Look abroad: cut the usual tax on imports by 1 point. That makes foreign goods a bit cheaper and shows partners you’re open for trade.</p>",
    task: "Bottom left → Trade → cut the default import tax by 1.",
    tab: "trade",
    confirmAfter: true,
  },
  {
    id: "tradeBooks",
    title: "Programme again",
    body: "<p>Open the Programme once more. The import-tax cut should sit with schools, taxes and skills — check how much political capital it costs before you chase a bigger deal abroad.</p>",
    task: "Bottom right → Programme; review what’s lined up.",
    tab: null,
    confirmAfter: true,
  },
  {
    id: "accession",
    title: "The Continental Union",
    body: "<p>Bigger prize: join the <b>Continental Union</b>. In Trade, open Trade blocs and try <b>Join</b>. France runs the club — and they don’t like you enough yet. You can’t join until that friendship improves.</p>",
    task: "Bottom left → Trade → Trade blocs; see why Join is blocked.",
    tab: "trade",
    confirmAfter: true,
    /* Close any open drawer so looking at Join is deliberate. */
    reopenTab: true,
  },
  {
    id: "diplomacy",
    title: "Warm Paris",
    body: "<p>So fix that. Open Diplomacy and pick the choice that <b>improves relations with France</b> — plan a summit.</p>",
    task: "Bottom left → Diplomacy → summit with France.",
    tab: "diplomacy",
  },
  {
    id: "forecast",
    title: "The forecast",
    body: "<p>Before time moves on, <b>Deliver</b> (bottom right) opens a preview of the next year or so — growth, prices, jobs, the budget gap, debt, and so on.</p><p>If you have changes lined up it’s called <b>Forecast for this bill</b>. If the Programme is empty it’s <b>Forecast on current policy</b> — same idea, nothing new. Confirm moves you forward; Go back leaves things as they are.</p>",
    task: null,
    tab: null,
  },
  {
    id: "deliver",
    title: "Deliver the Programme",
    body: "<p>Now hit Deliver (bottom right). Confirm the forecast to lock in the summit and the rest of your plan — the France visit starts after that.</p>",
    task: "Bottom right → Deliver → Confirm and deliver.",
    tab: null,
    trackStartQ: true,
  },
  {
    id: "warmFrance",
    title: "Make the visit count",
    body: "<p>Messages about the summit will pop up. Each time, choose the option that <b>improves relations with France</b> — you need them at 52 or higher before the Continental Union will let you apply.</p>",
    task: "Get France to 52+ (pick the friendly summit options).",
    tab: null,
  },
  {
    id: "joinCU",
    title: "Apply to join",
    body: "<p>France is warm enough. Open Trade → Trade blocs and stage <b>Join</b> on the Continental Union. Joining then takes a few turns on its own — no more capital after this bill.</p>",
    task: "Bottom left → Trade → Trade blocs → Join.",
    tab: "trade",
    reopenTab: true,
  },
  {
    id: "deliverJoin",
    title: "File the application",
    body: "<p>Deliver the Join bill (bottom right). That files your application; the rest of the process then ticks forward each quarter by itself.</p>",
    task: "Bottom right → Deliver → file the application.",
    tab: null,
  },
  {
    id: "accessionWait",
    title: "Wait out joining",
    body: "<p>Joining takes a few turns: apply → line up the rules → full member. Keep pressing <b>Next quarter</b> (bottom right — empty Programme is fine). Watch Trade blocs for progress.</p>",
    task: "Bottom right → Next quarter until you’re in the Continental Union.",
    tab: null,
  },
  {
    id: "done",
    title: "You’re away",
    body: "<p><b>Congratulations</b> — you’ve put together a first plan, warmed up France, and joined the Continental Union. The tutorial is done; the job is yours. Do what you want.</p>",
    task: null,
    tab: null,
  },
];

export function coachStepCount() {
  return COACH_STEPS.length;
}

export function coachStepAt(i: number) {
  return COACH_STEPS[i] || null;
}

function taxRateUp(draft: any, law: any, id: string, minPts: number) {
  const d = draft.taxes && draft.taxes[id] ? draft.taxes[id].rate : null;
  const l = law.taxes && law.taxes[id] ? law.taxes[id].rate : null;
  if (d == null || l == null) return false;
  return d - l >= minPts;
}

function defaultTariffCut(draft: any, law: any, minPts: number) {
  const d =
    draft.tariffSchedule && draft.tariffSchedule.default != null
      ? draft.tariffSchedule.default
      : null;
  const l =
    law.tariffSchedule && law.tariffSchedule.default != null
      ? law.tariffSchedule.default
      : null;
  if (d == null || l == null) return false;
  return l - d >= minPts;
}

function hasSummitWith(draft: any, partnerId: string) {
  const missions = (draft && draft.missions) || {};
  return missions[partnerId] === "summit";
}

function playerSeatId(ctx: CoachCtx) {
  const role = (ctx && ctx.homeRole) || "home";
  return role === "home" ? "kingdom" : role;
}

function franceRel(ctx: CoachCtx) {
  if (!ctx || !ctx.rel || ctx.rel.france == null) return 50;
  return ctx.rel.france;
}

/** Chair bar for Continental Union apply (see blocs.ts accession.chairRelationMin). */
const FRANCE_CU_REL_MIN = 52;

function inContinentalUnion(ctx: CoachCtx) {
  const bm = ctx && ctx.blocMember;
  if (!bm) return false;
  return bm[playerSeatId(ctx)] === "continental_union";
}

function cuAccession(ctx: CoachCtx) {
  const acc = ctx && ctx.blocAccession;
  if (acc && acc.blocId === "continental_union") return acc;
  const by = ctx && ctx.blocAccessionByCountry;
  const seat = by && by[playerSeatId(ctx)];
  if (seat && seat.blocId === "continental_union") return seat;
  return null;
}

interface CoachSubtask {
  id: string;
  label: string;
  done: boolean;
}

/** Multi-part checklist for a step (or null / single-item → use `task` string). */
export function coachSubtasks(
  stepIndex: number,
  ctx: CoachCtx,
): CoachSubtask[] | null {
  const step = COACH_STEPS[stepIndex];
  if (!step || !step.task) return null;
  const draft = (ctx && ctx.draft) || {};
  const law = (ctx && ctx.law) || {};
  const tab = ctx && ctx.getTab ? ctx.getTab() : null;
  switch (step.id) {
    case "budget": {
      const d = (draft.spend && draft.spend.education) || 0;
      const l = (law.spend && law.spend.education) || 0;
      return [
        {
          id: "tab",
          label: "Open Budget (bottom left)",
          done: tab === "budget",
        },
        {
          id: "edu",
          label: "Raise Education by at least +0.5",
          done: d - l >= 0.5,
        },
      ];
    }
    case "deficit":
      return [
        {
          id: "programme",
          label: "Open Programme (bottom right) and check the budget balance",
          done: tab === "bill",
        },
      ];
    case "books":
      return [
        {
          id: "programme",
          label: "Open Programme (bottom right) and look over the plan",
          done: tab === "bill",
        },
      ];
    case "tradeBooks":
      return [
        {
          id: "programme",
          label: "Open Programme (bottom right) and review what’s lined up",
          done: tab === "bill",
        },
      ];
    case "taxes":
      return [
        {
          id: "tab",
          label: "Open Taxes (bottom left)",
          done: tab === "taxes",
        },
        {
          id: "vat",
          label: "Raise VAT by at least 3 points",
          done: taxRateUp(draft, law, "vat", 3),
        },
        {
          id: "corp",
          label: "Raise company tax by at least 5 points",
          done: taxRateUp(draft, law, "corpTax", 5),
        },
      ];
    case "policies":
      return [
        {
          id: "tab",
          label: "Open Policies (bottom left)",
          done: tab === "policies",
        },
        {
          id: "skills",
          label: "Turn on National skills guarantee",
          done:
            !!(draft.policies && draft.policies.skills) &&
            !(law.policies && law.policies.skills),
        },
      ];
    case "trade":
      return [
        {
          id: "tab",
          label: "Open Trade (bottom left)",
          done: tab === "trade",
        },
        {
          id: "tariff",
          label: "Cut the default import tax by at least 1",
          done: defaultTariffCut(draft, law, 1),
        },
      ];
    case "diplomacy":
      return [
        {
          id: "tab",
          label: "Open Diplomacy (bottom left)",
          done: tab === "diplomacy",
        },
        {
          id: "summit",
          label: "Plan a summit with France (improves relations)",
          done: hasSummitWith(draft, "france"),
        },
      ];
    case "joinCU":
      return [
        {
          id: "tab",
          label: "Open Trade (bottom left)",
          done: tab === "trade",
        },
        {
          id: "join",
          label: "Under Trade blocs, stage Join on the Continental Union",
          done: !!(
            draft.blocAccession &&
            draft.blocAccession.blocId === "continental_union"
          ),
        },
      ];
    case "accessionWait": {
      const member = inContinentalUnion(ctx);
      const acc = cuAccession(ctx);
      const stepN = member ? 2 : acc && acc.step != null ? acc.step : 0;
      return [
        {
          id: "applied",
          label: "Application sent",
          done: member || !!acc,
        },
        {
          id: "align",
          label: "Rules lined up",
          done: member || stepN >= 2,
        },
        {
          id: "member",
          label: "Full Continental Union member",
          done: member,
        },
      ];
    }
    default:
      return null;
  }
}

export function coachAwaitSatisfied(stepIndex: number, ctx: CoachCtx) {
  const step = COACH_STEPS[stepIndex];
  if (!step) return false;
  if (!step.task) return false;
  const subs = coachSubtasks(stepIndex, ctx);
  if (subs && subs.length > 1) return subs.every((s) => s.done);
  if (subs && subs.length === 1) return subs[0].done;
  const tab = ctx.getTab ? ctx.getTab() : null;
  switch (step.id) {
    case "accession":
      return tab === "trade";
    case "deliver":
      return ctx.q > (ctx.startQ != null ? ctx.startQ : 0);
    case "warmFrance":
      return franceRel(ctx) >= FRANCE_CU_REL_MIN;
    case "deliverJoin":
      return !!cuAccession(ctx) || inContinentalUnion(ctx);
    default:
      return false;
  }
}
