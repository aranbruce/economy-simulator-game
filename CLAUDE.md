# Economic simulator

A Next.js browser game. You are Chancellor of a fictional country, named by
the player and defaulting to "The Kingdom", and you run its economy through a macro model: tax rates and structures, departmental
spending, legislation, drug and vice law, tariffs and trade treaties. Each turn
is a quarter. Twenty quarters to an election.

The permanent backdrop is a **fictional packed world map**: only your country
and the mapped trade-partner realms (real coastlines / silhouettes, invented
positions on a shared ocean). No other countries are drawn. If the map fails
to load, the game falls back to the procedural country canvas. The map never
owns game logic.

The reference single-file build remains at `chancellor.html` (frozen historical
artifact — the live app is modular `lib/sim/*`). Do **not** run
`scripts/extract-engine.mjs` against it; that would overwrite the modular engine.
The live app is Next.js App Router: UI in `components/`, pure sim in `lib/sim/`.

## Commands

```bash
pnpm install
pnpm dev             # Next.js at http://localhost:3000
pnpm build           # production build
pnpm test            # node test/sim.js && node test/calibration.js
```

## Architecture

| Path | Contains |
|---|---|
| `app/` | Next.js layout, page (client dynamic GameApp), glass CSS |
| `lib/sim/engine.js` | Statute book, state, aggregate, step, project, bill, map, events, panel HTML |
| `lib/sim/worldTrade.js` | Bilateral trade clearing across seats |
| `lib/sim/fxAreas.js` | Currency-area Taylor rules and FX vs USD |
| `lib/sim/partners.js` | Partner id → ISO country sets for the world map |
| `components/game/GameApp.jsx` | Shell: topbar, dock, drawer, despatch; wires the engine |
| `components/map2d/WorldMap.jsx` | Flat world map, partner colours, click-to-trade |
| `components/map2d/FlatMap.jsx` | Procedural country canvas fallback |
| `public/geo/countries-110m.json` | Natural Earth topojson |
| `chancellor.html` | Original single-file reference |

Engine sections (inside `lib/sim/engine.js`) still follow the numbered banners:

| Section | Contains |
|---|---|
| 1. The statute book | All content data: `TAXES`, `REGIMES`, `POLICIES`, `VICE`, `PARTNERS`, `DEPTS`, `FACTIONS` |
| 2. State | `newGame()`, `baseLaw()`, the `G` global |
| 3. Aggregation | `aggregate()`, `revenue()`, `spending()`, `balanceOf()`, `potentialGrowth()`, and the income tax engine |
| 4. The engine | `step()` — one quarter of macro simulation |
| 5. Projection | `project()`, `projectionWarnings()` — the pre-budget forecast |
| 6. The bill | `billClauses()` — diffs `G.draft` against `G.law` and prices each change |
| 7a. The map |  `REGIONS`, `countryField()`, `mapGeometry()`, `regionStats()`, `paintMap()` |
| 7. Rendering | Tabs, sliders, cards, SVG charts |
| 8. Despatches | `EVENTS`, elections, crises, game over |
| 9. Flow | `enact()`, `projectionModal()`, button wiring |

### Multi-country world

Every realm runs the same macro core via `stepCountry` / `stepWorldPartners`.
`G.world[id] = { econ, law, prevLaw }` holds full bags for AI seats; the player's
live `G.econ` remains canonical and is mirrored into `G.world[playerId]`.

- **Politics stay player-only** — AI seats use frozen `lawForRole` plus a light
  automatic fiscal rule; no bills, factions, or capital.
- **Trade** — `refreshWorldTrade` clears bilateral flows (`lib/sim/worldTrade.js`);
  cleared flows phase into the player's expenditure block over about a year.
- **FX** — seats sharing `NATION_PROFILE.currency` share a Taylor rate and FX path
  vs USD (`lib/sim/fxAreas.js`).
- **Bloc joins** — membership / CET / access only; growth effects are endogenous
  through tariffs and trade, not one-shot pulses.
- **`project()` / `simulate()`** clone `G.world` (and `worldTrade`); add new
  top-level world state to `MUTABLE` when needed.

Opening nation-table headlines stay on profile pins until after Q1 so the books
do not jump when world bags first advance.

### The central data structure

Three copies of the law exist at once, and the distinction matters:

- `G.law` — what is currently in force
- `G.draft` — what the player is proposing (every UI control edits this)
- `G.prevLaw` — what was in force last quarter, used to compute fiscal impulse

`billClauses()` is the diff between `law` and `draft`. It generates both the
displayed clause list and its political capital price. `enact()` copies draft
over law, charges capital, and runs `step()`.

### Income tax and national insurance

These are not flat rates on an abstract base. `INCOME_DIST` is the taxpaying
population in weighted slices, ending in a Pareto tail (the top 0.1% sits at
£1.2m). Every income calculation integrates over it, which is what makes
thresholds as powerful as rates.

- `law.income` holds the allowance, the band array and an `uprate` flag
- `law.ni` holds employee main and upper rates, the employer rate, and three
  separate thresholds
- `incomeYield()` returns income tax, employee NI and employer NI separately
- `incomeProfile()` returns the population-weighted marginal rate and a
  progressivity measure, which feed potential growth, the NAIRU and the Gini

Three things here are easy to get wrong and are pinned by tests:

1. **Behavioural response applies only above the kink.** `bandKink()` finds
   where the taxpayer's top band starts; income below it does not shrink when
   the top rate rises. Applying the elasticity to a person's whole income makes
   every top-rate rise lose money, which is wrong and makes the politics
   unplayable.
2. **The response is iso-elastic**, `((1-mtr)/(1-MTR_REF))^e`, so the
   revenue-maximising marginal rate is `1/(1+e)`. The additional rate peaks near
   55%, the higher rate near 70%. The basic rate does not turn over on receipts
   alone; its real cost lands on growth and unemployment through
   `incomeProfile()`, not on the yield.
3. **Employer NI is a different tax from employee NI.** It has no upper limit,
   it raises the NAIRU (`erGap*0.055`), it feeds through into prices, and it
   hits the business faction. The two share a base, so an employee rise does
   nudge employer receipts, but only second-order.

**Fiscal drag** falls out of this for free and is one of the better mechanics.
Thresholds are nominal. `econ.wageIndex` grows with nominal GDP every quarter.
If `law.income.uprate` is false the thresholds stand still, real receipts climb
with no legislation, and `dragRatio()` drives a growing penalty with workers and
pensioners. Freezing thresholds is the most effective and most cowardly tax rise
in the game.

Calibration: at the default schedule, income tax raises about 9% of GDP,
employee NI ~1.7% and employer NI ~3.6% (on the labour share after capital
income is split out), and the opening deficit sits near 4.9% of GDP.
`OTHER_REV` is the plug that holds that; if you change the income model,
re-derive it rather than leaving the opening position adrift.

### The model, briefly

`step()` runs in a fixed order and the order is load-bearing:

1. Fiscal impulse from what the bill changed, spread over three quarters
   via `econ.carry`
2. Demand: potential growth, plus impulse, minus rate drag, minus output-gap
   correction, minus a convex yield shock
3. Prices: a Phillips curve on the output gap with partly-anchored expectations
4. The Bank responds with a Taylor rule (the player does **not** set rates)
5. Labour: Okun's law toward a NAIRU that policy can move
6. Debt on the standard r-minus-g dynamic; gilt yields rise **convexly** in
   debt and deficit, so the market ignores you until suddenly it does not
7. Social indicators, then trade relations
8. Faction approval, then political capital

`aggregate(law)` is the single place where every enacted thing is summed into
one effect bundle. Adding a new content type means adding one loop there and
nothing else in the engine.

## Layout

The world map (or procedural country fallback) is permanent scenery, not a tab.
`#worldMapLayer` / `#mapLayer` sits at z-index 0. Everything else floats over it:

- `#topbar` — country, term, and the stat chips (`chip()` in `renderChrome`)
- `#dock` — the bottom toolbar: one button per drawer, then the bill summary
  and the Deliver action, which shows the forecast and asks you to proceed.
- `#drawer` — a parchment sheet over the map. `tab` holds the open drawer id,
  or `null` for the undisturbed map. On wide screens it docks to the right.

`renderChrome()` paints the top bar and dock; `renderPanel()` fills
`#drawerBody` and returns immediately when `tab` is null. Clicking a partner on
the world map sets `tab = "trade"`.

## The map

A 2D canvas, no libraries at all. The coastline is radial noise sampled on
`(cos, sin)` of the bearing, so it closes up seamlessly, and the interior is
carved into nine regions by nearest seed.

- `mapGeometry(W, H)` returns typed arrays and touches no canvas, so the whole
  geometry is testable headlessly. `test/map.js` asserts every region has
  territory, no land touches the frame, the landmass is connected, and each
  region's seed sits inside its own region.
- Regions carry a `mix` of factions and a `prosper` multiplier. `regionStats()`
  turns national numbers into regional ones, which is what makes the choropleth
  say something rather than just decorate. Weights must sum to 1 and each `mix`
  must sum to 1; both are asserted.
- The outline comes from overlapping `LOBES` rather than one radial blob, which
  is what produces peninsulas and bays instead of a circle. `ISLES` are offshore
  and `LAKE` is a negative lobe. The tests assert the mainland is one piece,
  that offshore islands exist, and that inland water exists, because a shape
  with none of those reads as synthetic.
- `mapGeometry()` also flood-fills ocean from the frame, so water it cannot
  reach is drawn as a lake, and dilates outward from the coast to give a
  continental shelf. That shading does more for "looks like a map" than the
  outline does.
- `paintMap()` recolours from a cached geometry rather than recomputing it, and
  the ramp runs cool-to-warm with `good` deciding which end is which, so every
  metric reads the same way.
- Trade partners appear as compass markers around the edge, coloured by
  relations.
- A canvas failure falls back to a message. No game logic lives in the map.

**The world map is a 2D canvas** (`WorldMap.jsx`) over Natural Earth GeoJSON.
Game logic must not live in the map module; load failure falls back to the
procedural country canvas. The reference `chancellor.html` remains a
self-contained single file without map libraries.

## Events

Ordinary events are deliberately sparse: a four-quarter cooldown and a 20%
roll, which lands at roughly one event every nine quarters. Guaranteed
set-pieces still fire at mid-term (Q8) and late-term (Q16). Frequent
interruptions stop the budget being the game.

**Major world episodes** (`major: true` on the event) ride a separate track.
`G.nextMajorQ` is scheduled 16–32 quarters (4–8 years) ahead on `newGame` and
again when an episode ends. When due, Deliver presents a start despatch; choosing
an option applies shocks and calls `beginEpisode`. While `G.episode` is active,
no second major can fire. When `G.q >= episode.endsQ`, Deliver shows an end
despatch (“Noted”), runs any tariff unwind, clears the episode, and reschedules
the next major. Ordinary bilateral/domestic events may still fire during a major.

The nine majors: `globalRecess`, `aiBoom`, `worldInflation`, `commodityShock`,
`globalEasing`, `tradeWar`, `chinaSlowdown`, `creditCrunch`, `greenTransition`.
`tradeWar` raises real `tariffSchedule` defaults (player and/or AI seats) and
restores them on end unless the player chose to keep the wall.

About 63% of the ordinary pool by weight is foreign relations, which is where
the interesting bilateral consequences live: ultimatums over the digital services
tax, sanctions packages that force a choice between allies and cheap inputs,
bloc invitations, swap lines, migration deals, espionage. A test asserts that
share stays above half and that diplomatic options actually move `G.rel`, since
a "diplomatic" event that changes no relations is just flavour text.

**Shocks are structural channels only.** Options go through `applyEventOption`,
which expands declarative `shocks`, `setRel`, `fac` and `capital`, then any
remaining `f()` for law or structural stock edits (tariffs, bank balance sheets,
demography). Allowed channels: `world`, `worldPartner` (+ `partner`),
`worldInfl`, `worldRate`, `worldTfp`, `tot`, `ucost`, `labour`, `migrate`,
`part`, `tfp` (alias `potential`), `supplyShock`, `riskPremium`, `expect`,
`spend`, `uncertainty`, `contact`, `approval`, `srv`, `hlt`, `cri`. Legacy
`demand`/`growth` map into `uncertainty`. Global pulses on the player are
mirrored into AI seats via `globalModsForAiSeat` so named partners feel
synchronised cycles (not only the rest-of-world residual). Do not write CPI
via an `inflation` mod, and do not smash `services` / `health` / `crime` /
`debt` / `A` in `f()` — use the social and TFP channels instead (fiscal bank
recaps go through `recapitaliseBank`).

If you add mutable top-level state such as `episode` / `nextMajorQ`, keep it on
`MUTABLE` and in `simulate()`'s clone list.

## Naming

Authored copy carries a `{C}` token instead of a country name, and `T()`
substitutes `G.country`. It is applied at exactly three points where authored
text reaches the screen: `despatch()` (covering every event, crisis and
verdict), the morning briefing, and the card blurbs in the drawers. Adding a new
place that shows authored copy means adding a `T()` call.

A test asserts no authored string contains a hard-coded country name, so this
cannot silently regress.

## Invariants

Breaking any of these will fail the suite, and should.

- **`project()` must never mutate live state.** It deep-clones `G` into a
  throwaway sim. There is an explicit test for this. If you add state to `G`,
  add it to the clone list in `project()`.
- **`step()` takes a `det` flag.** When true it must be fully deterministic
  (no `Math.random`), because the projection depends on it.
- **The opening deficit is near 4.9% of GDP** (UK mid-2020s band). It is the
  balance the whole difficulty curve is tuned around. Changing revenue anywhere
  means re-plugging `OTHER_REV`.
- **Every content item needs a nonzero measurable effect.** The suite asserts
  each policy moves debt, approval or potential. A policy with an empty `imp`
  and `fac` is a bug.
- **The map must never be load-bearing.** Any failure path renders the
  procedural country canvas instead. No game logic may live in the map module.
- **Political capital gates everything.** No path may enact a bill costing more
  than `G.capital`.
- **Taxes gated on legality must vanish when the law changes.** When a vice
  moves to a state where its duty is invalid, `G.draft.taxes[id].on` is forced
  false in the Society tab handler.

## Adding content

This is the main extension path, and it is meant to be pure data.

### Income tax and NI are not in `TAXES`

The banded income tax and the two national insurance taxes are modelled
separately, because a single rate cannot express a threshold. They live in
`law.income` and `law.ni` and are integrated over `INCOME_DIST`, a 23-slice
income distribution with a Pareto top tail.

- `effectiveBands(law)` is the one place the schedule is assembled. **The
  personal allowance is the authoritative start of band one**; `bands[0].from`
  is ignored. This was a real bug once: the allowance slider moved nothing
  because `bands[0].from` silently defined where tax started. There are
  regression tests for it.
- Behavioural response is `declaredFactor()`, an iso-elastic response on the
  net-of-tax rate with an elasticity that rises with income, plus an
  informality term above a 45% marginal rate. There is deliberately no
  `laffer()` fudge on income; the curve falls out of the distribution.
- Employer NI is a tax on the job, not the pay packet. It has no upper limit,
  raises structural unemployment, and feeds into prices.
- Thresholds uprate with inflation each quarter unless the player freezes them.
  Freezing is fiscal drag: real receipts rise every year without a vote.
  `dragRatio()` reports how far the allowance has fallen in real terms.

**A new tax** — push to `TAXES`. `base` is the percent of GDP raised per point
of rate, `laff` is the rate at which the Laffer curve peaks. Set `on: false`
and a `pc` cost to make it something the player must introduce. Add `req:
["cannabis", "legal"]` to gate it behind a legality state.

**A new policy** — push to `POLICIES`. `cost` is annual percent of GDP
(negative saves money), `pc` is capital to enact. `imp` keys are read in
`aggregate()`: `pot` trend growth, `gro` demand, `inf` prices, `gini`
inequality, `srv` services, `lib` liberty, `cri` crime, `hlt` health, `env`
environment, `nairu`, `eva` evasion, `blk` black market. `kills` lists
mutually exclusive policies.

**A new vice** — push to `VICE` with two or more states. Add the matching duty
to `TAXES` with a `req` gate, and point `tax:` at it.

**A new trade deal** — add to a partner's `deals`. `need` supports `relation`,
`deal`, `policyOn`, `policyOff`, `taxOff`, `tariffMax`, `deptMin`. Blockers
render automatically from `dealBlockers()`. Deal `open`, `tariffCut` and
`access` do not jump competitiveness on the enactment quarter: they phase in
through `openEff`, `tariffCutEff` and `tradeDepth` at `DEAL_PHASE` (~five years).
Faction effects and other `ch` keys (labour, tfp, …) still apply immediately.

**A new event** — push to `EVENTS` with `cond`, `w` (weight) and three options.
Options mutate `G` directly and may rewrite `G.law`. The suite exercises every
option, so a typo in an event will fail the build rather than surface in play.
For a major world episode, set `major: true`, `duration`, `endTitle` /
`endText` / `endStamp`, and keep it off the ordinary random pool (majors use
`rollMajorEvent` / `G.nextMajorQ`).

## Testing

**`document.getElementById` returns `null` for any id not assigned anywhere in
the file.** This matters: a stub-for-everything harness let
`$("resetBtn").onclick` survive long after that element was deleted from the
markup, which throws on load in a real browser and passed silently here. If you
remove an element, the suite will now tell you what still reaches for it.

`test/harness.js` extracts the `<script>` block from `index.html`, stubs the
DOM, and runs it in a `vm` context. It exposes the internals plus three
controls the tests need:

- `autoDespatch(0 | 'random' | null)` — modals normally wait for a click.
  Headless, nothing clicks, so the quarter never completes. Verdicts are
  deliberately **not** auto-clicked, since that would call `newGame()` and wipe
  the run under test.
- `disableEvents()` / `enableEvents()` — balance A/B tests need events off,
  because an event can legitimately overwrite the law under test. This bit us
  once: a fortress-economy run had its tariff conceded away by the trade-row
  event, and the assertion was wrong, not the game.

The suite ends with a balance report printing seven playstyles over twenty
quarters. Read it after any model change. Current state: land value shift
grades B, austerity survives but services collapse to 37, unfunded tax cuts and
closed-economy both end in a debt crisis.

## Design

iOS Liquid Glass over a dark planet. Translucent surfaces
(`backdrop-filter: blur(32px) saturate(190%)`), a specular top edge on every
raised element (`--spec`), generous concentric radii, and iOS system colours
(`--blue #0A84FF`, `--green #30D158`, `--red #FF453A`, `--amber #FF9F0A`).
Depth comes from blur and stacking, never from heavy borders.

Type is `-apple-system` first, so it renders in real SF Pro on Apple hardware
and falls back to Inter elsewhere. There is no monospace: `--mono` aliases the
sans stack and figures align via `font-variant-numeric: tabular-nums`.

Only five variables are referenced from JS template strings (`--red`,
`--ink-soft`, `--ink-faint`, `--mono`, `--sans`), so the stylesheet can be
rewritten freely provided those keep working. Chart colours live in `COL` in the
JS and the world map’s partner accents in `relationColour()`; both follow the
same system palette and must be changed together with the CSS.

Charts are hand-rolled SVG in `lineChart()`. No chart library, deliberately, so
the file stays dependency-free.

## Rules and sandbox

`G.sandbox` (**on by default**) suppresses every removal-from-office path:
election defeat, a party coup after four quarters below 20% approval, and the
terminal debt and inflation crises. The crisis still fires and still reports
itself in the briefing; you simply keep the job. `gameOver()` returns early and
`election()` returns you regardless. Toggle it at the foot of the bill drawer.

Tests that exercise real failure modes must set `sandbox = false` first, or the
game never ends and long runs push debt to its clamp. One test caught exactly
that when sandbox was introduced.

## The equations

The engine is written as named macro relationships rather than tuned
coefficients. All parameters sit together near `FISCAL_K`.

### Output is the national accounts identity

`Y = C + I + G + X - M`. Each component has its own behavioural equation and
its own partial adjustment, which is what makes a fiscal impulse build over
several quarters rather than land all at once.

- **C.** Autonomous consumption plus an MPC out of disposable income, less an
  **ex ante** real rate term. Disposable income is output, less household taxes,
  plus transfers. Households pay the average rate on baseline income and the
  **marginal** rate on anything above it, which is the automatic stabiliser and
  most of what keeps the multiplier finite.
- **I.** Accelerator plus user cost of capital,
  `uc = real rate + depreciation + corporate tax wedge`. This is where
  corporation tax and the policy rate actually bite on investment.
- **G.** Government consumption and investment, taken straight from the budget
  and set against *trend* output, since spending plans are made in advance.
  **Transfers are not G**: welfare is income, and reaches output only through
  the consumption function. Each spending line has an import content, so
  procurement-heavy defence multiplies less than labour-heavy health.
- **X and M.** World demand and competitiveness with Marshall-Lerner
  elasticities. Competitiveness runs on **underlying** prices, not headline:
  VAT is border-adjusted, so a VAT rise is not a real appreciation.

**No multiplier is set anywhere.** They emerge from the MPC, the marginal tax
leakage and the import propensity, so the ordering (purchases beat transfers
beat tax cuts) is produced rather than imposed. There is a test for that
ordering.

### The supply side is growth accounting

Potential output is a Cobb-Douglas production function, not an assumed growth
rate:

    Y* = A * K^alpha * (L*h)^(1-alpha)
    g(Y*) = g(A) + alpha*g(K) + (1-alpha)*(g(L) + g(h))

- **K** comes from the investment block and accumulates:
  `K += (I - depreciation*K)/4`. A decade of weak investment now shows up as
  weak supply instead of being forgotten.
- **I is neoclassical.** Desired capital is the first-order condition
  `K* = alpha*Y/uc`, and investment covers depreciation and trend growth plus
  partial adjustment toward the gap. Corporation tax and the policy rate enter
  through `uc = real rate + depreciation + corporate tax wedge`, which is where
  they actually bite.
- **A** is TFP, trending at a shared `TFP_FRONTIER` plus catch-up from relative
  income `yRel`, lifted by the knowledge stock
  `R` (from the research budget and research-credit effort), openness and trade
  depth. It is the binding constraint, as it has been for the UK.
- **L** is the labour force net of structural unemployment, so migration policy
  and the tax wedge both feed supply. **h** is human capital from education
  spending, with Mincerian returns (a flow on the current education share, not
  a skills stock).

Trend growth comes out near 0.8-1.0% a year, which is the right order for the
UK, and it is derived rather than set.

**Desired capital is unit-elastic to the user cost**, which at quarterly
frequency made investment whipsaw on every move in the policy rate and set off a
limit cycle through the gap, inflation and the Bank. Firms plan against a
smoothed cost of capital (`UC_SMOOTH`), and `K_ADJ` is deliberately slow. If you
raise either, check the 40-quarter baseline path for oscillation.

### Exchange rate

Uncovered interest parity with a risk premium:

    fx = 1 + FX_UIP*(rate - world rate) - FX_RISK*(risk premium)

A higher policy rate appreciates the currency; a fiscal scare depreciates it
even while rates rise, which is the mechanism behind a gilt crisis and a weak
pound happening together. Trade volumes respond to the real exchange rate with
a lag, so the balance worsens on impact before volumes catch up: a J-curve.

An unfunded tax cut now appreciates the currency about 0.6% and worsens net
trade, which is the twin-deficit result arriving endogenously rather than being
written in.

### Public services: cost disease, not an assumed decay

**This used to be `demandNeed += 0.030` a quarter.** Services degraded because
they were told to, at a rate nobody could justify. They now degrade for the two
reasons they actually do:

    unit cost = real wage / public sector productivity
    volume    = real spending / unit cost
    need      = population * demand per head(dependency ratio)
    quality   = volume / need

**Baumol.** Public services are labour-intensive and their measured productivity
barely moves (`PUB_PROD_GROWTH` 0.05% a year) while their wage bill has to track
the wider economy. A pound of health spending buys less volume every year.

**Ageing.** `dependency` drifts from 0.30 toward 0.37, raising health demand
(`AGEING_HEALTH`) and pension caseload, and slowing labour force growth.

Quality now falls about 1.2% a year at a constant share of GDP, against a real
world estimate of roughly 1 to 1.5% for health. That number is derived from the
productivity gap and the demography, not chosen. `pensionAdequacy` falls the
same way, so a fixed welfare share buys less per pensioner every year and
pensioner approval reflects it. This is the demographic squeeze the triple lock
argues about.

### The propensity to consume falls with income

`mpcAt()` gives each of the 23 income slices its own MPC, from 0.88 at the
bottom to 0.22 at the top, and `incomeProfile()` weights them by post-tax income
to produce an aggregate. The tax system is already integrated over this same
distribution, so **the incidence of a tax change now drives demand**: raising the
personal allowance lifts the aggregate MPC, cutting the additional rate lowers
it, and the constrained share moves with it.

Before this, the split was keyed off the Gini alone and could not tell those two
policies apart.

**Known oddity.** A deficit-financed cut to the additional rate can still come
out weakly contractionary. The machinery for that result is real — a low-MPC
group gets the money while the deficit feeds yields, the risk premium and the
currency — and it is roughly the argument made about the 2022 mini-budget.
`MPC_INCIDENCE` is pinned near 0.65 by calibration ready-reckoners on relative
demand (transfers / allowance ≥ basic-rate cut ≥ additional-rate cut).

### Households are heterogeneous (Campbell-Mankiw)

    C = lambda * YD_constrained + (1-lambda) * C_permanent

A rule-of-thumb share spends its disposable income; the rest smooth against
permanent income. Constrained households take a smaller share of market income
than of transfers, so **the distribution of a fiscal change now matters for
demand and not only for fairness**. A pound of transfers scores 0.30 against a
top-rate cut of the same size at −0.11: money given to savers is saved. With the
single MPC this model used to have, redistribution had no demand effect at all.

### Housing and mortgage fixation

Bank rate no longer hits consumption through a single `C_RATE` coefficient alone.
A mortgage stock (`mortgageDebt`) carries an effective rate that crawls toward
the policy rate with a fixation lag (`MORT_FIX`), debt service enters the
consumption target, and house prices carry a small wealth effect. Planning
liberalisation, rent controls and social housebuilding shift the house-price
target on the supply side; regional `housing` weights also pick up national
house-price growth. House-price falls raise loan PD and credit spreads (via a
lagged price `hpLag`), and spreads pass through more strongly into the user cost
of capital so a housing crunch scars private investment. There is still no full
household balance-sheet / credit-cycle model.

### Public capital is a factor of production

Infrastructure spending accumulates into `KG` and enters the production function
with its own elasticity, rather than being credited to TFP through a fudge
coefficient. Twenty-four quarters at 5% of GDP builds a stock of 84 against 62
at 0.5%, and the difference shows up in potential output.

### Knowledge stock feeds TFP growth

The **Research & innovation** budget line accumulates into `econ.R` the way
infra builds `KG`. Ideas obsolete at `DEPREC_R` (~4%/year). TFP growth picks up
`R_TFP * (R/R0 - 1)`, so underfunding research slowly scars productivity and
overfunding compounds. A small share of education above baseline spills into R
(universities). The **Research credits** policy no longer adds a flat `tfp`
while on: it adds `rndEffort` (private labs pulled in by the credit) into the
same accumulation. Education still lifts potential separately through `h` and
the NAIRU.

### Wages, then unit labour costs, then prices

    wage growth = expected inflation + productivity growth + w*(u* - u)
    ULC growth  = wage growth - productivity growth
    inflation   = pass-through of ULC + import prices + indirect taxes

Prices no longer respond to the output gap directly. This is the channel the
employer NI wedge, the minimum wage and the participation margin actually use.

### Credibility is a stock

Anchoring is earned by keeping inflation near target and lost by missing it, and
it sets how much weight expectations put on the target rather than on recent
experience. A clean run builds it from 0.60 to 0.87; a burst of double-digit
inflation destroys it.

### Hysteresis, and the hot baseline

A sustained output gap moves potential: booms pull in capacity, slumps scar it.
Without this the baseline ran persistently 1.5 to 3.7% above potential, which
dragged net trade to −7.9% of GDP and distorted everything measured off the gap.
With it, the gap converges near zero, net trade settles at −2.4% and trend growth
comes out at 1.11% a year.

### The effective lower bound

Policy cannot cut below `RATE_FLOOR`. At the bound the monetary offset
disappears, so fiscal multipliers rise on their own, and a fall in inflation
raises the real rate instead of lowering it. `econ.atBound` reports it.

### Welfare is a caseload, not a bill

The welfare slider sets **generosity**, not total spending. What it costs depends
on how many people are claiming:

    cost = generosity + 0.30 * (unemployment - u*)
    per claimant = generosity / caseload(unemployment)

That 0.30 points of GDP per point of unemployment is the size of the UK's
cyclical welfare bill, and it makes the spending-side automatic stabiliser real:
a recession widens the deficit whether or not the Chancellor does anything, and
a fixed budget spread over a bigger caseload pays each claimant less.

### Tax bases are not GDP

Every tax used to sit on a base proportional to output, which was the crudest
thing left in the revenue model. Each now sits on the aggregate it actually sits
on, tagged by `basis` and scaled by `taxBaseIndex()`:

| basis | taxes | behaviour |
|---|---|---|
| consumption | VAT, all the duties | tracks C, not Y |
| profits | corporation tax, windfall, digital | swings 2.6x as hard as output |
| assets | CGT, inheritance, wealth, land, FTT | discounted at the real rate |
| volume | fuel duty | physically shrinking base |
| wages | income tax, NI | the wage bill |

Three consequences worth knowing:

- **Corporation tax is now properly volatile.** The profit share is 2.6 times as
  cyclical as output, which is why receipts collapse in a recession and overshoot
  in a boom. Receipts are lagged (`CORP_LAG`) because the tax is paid in arrears.
- **Capital gains follow the interest rate.** Asset prices are discounted at the
  real rate, so a tightening cycle takes CGT receipts with it, with a lag.
- **Fuel duty erodes on its own.** The base shrinks 1.6% a year as engines
  improve, faster under a carbon price. Receipts fall from 0.91% of GDP to 0.69%
  over fifteen years at an unchanged rate, which is a real fiscal problem rather
  than a modelling curiosity.

### Growth is not fiscally neutral

Spending is a plan in **real** terms set against trend output, so its share of
GDP falls when the economy runs ahead of trend and rises in a slump. Receipts are
about 1.3 times as elastic as output, because profits, capital gains and
transaction taxes are all strongly cyclical.

Before this the books were pure ratios on both sides, so growth changed nothing
except through the debt dynamics and you could not grow your way out of a
deficit. You now can, and a recession widens the gap from both directions.

### Three ways to set a budget

`law.mode[dept]` takes one of:

- **share** — a fixed share of GDP, the default, so it grows with the economy
- **real** — indexed to inflation: the cash keeps its value, the share falls
- **service** — the standard is fixed and the cost follows it

They diverge sharply. Health over eight years: a fixed share scores 53,
inflation-indexing scores **48**, holding the service level scores 55 and costs
8.71% of GDP instead of 8.40%.

**Inflation-indexing is worse than a fixed share of GDP.** It covers price rises
but not the real wage growth of the people delivering the service, nor a growing
population. This is the clearest demonstration in the model of why a cash or
real settlement is not a standstill.

### Service level, not just a share of GDP

A share of GDP is a poor control on its own, because holding it constant still
lets the standard fall. Each service department therefore reports a **score**
alongside its budget:

    volume = real spending / unit cost of delivery
    score  = 55 * (volume / need) / baseline

and **Hold level** flips the control round: pick the standard, and the budget is
uprated each quarter to whatever that standard now costs. The share of GDP then
climbs visibly, which is the honest way to present it. `law.hold[dept]` stores
the target score, and holding is a costed clause in the bill like anything else.

Demography is static (`DEP_DRIFT = 0`), so the decay is Baumol alone at about
0.5% a year. The 1 to 1.5% usually quoted for health bundles ageing in with cost
disease; with a static dependency ratio only the cost disease half applies.

### Participation

Labour supply responds to the net-of-tax wage at an elasticity of 0.15, roughly
the aggregate of near-zero for prime-age men and much larger for second earners
and those near retirement. Before this, income tax could only reach employment
through the wage-bargaining wedge.

### The rest of the core

- **Phillips curve.** Expectations-augmented, with expectations partly anchored
  on target (`PI_ANCHOR`), which is what lets inflation de-anchor if it runs.
- **Taylor rule.** Heavily smoothed (`TAYLOR_SMOOTH` 0.26). It reads inflation
  net of most of the VAT echo, because central banks look through first-round
  indirect tax effects.
- **Okun's law** around a wage-setting equilibrium.
- **Wage setting (Layard-Nickell-Jackman).** `u*` rises with the tax wedge, the
  replacement ratio, and falls with skills spending. Employer NI enters twice:
  the part already shifted onto wages joins the general wedge, the part not yet
  shifted hits labour demand much harder. `WAGE_SHIFT` moves it across at 7.5% a
  quarter (Gruber 1997).
- **Debt dynamics.** `db = (r-g)/(1+g)*b - primary balance`, with a convex risk
  premium.
- **Tax revenue.** Constant-elasticity base response `B = B0*((1-t)/(1-t0))^e`
  (Saez 2001). Revenue peaks at `t* = 1/(1+e)`, so the elasticity and the
  revenue-maximising rate are the same statement.

### Defaults

Every default is UK 2025-26 outturn, checked against ONS, OBR, HMRC and IFS
figures rather than remembered:

| | model | UK |
|---|---|---|
| Receipts | 40.4% of GDP | 40.4% |
| Spending | 44.9% | 44.8% |
| Deficit | 4.5% | 4.4% |
| Debt | 94% | 94.3% |
| Income tax | 10.8% | 10.8% |
| National insurance | 6.5% | ~6.3% |
| VAT | 5.9% | 5.9% |
| Corporation tax | 3.3% | 3.2% |
| Consumption | 61% | ~61% |
| Government | 22% | ~22% |

Opening macro state is UK mid-2026: Bank rate 3.75%, CPI 3.2%, unemployment
4.9% against an equilibrium of 4.1%, ten-year gilt 5.05%.

Two collection factors carry deliberate structural differences. Employee NI is
collected at 62% because this model has no upper earnings limit, so a flat 8%
would raise far more than the UK's 8%-then-2% structure; the visible rate stays
at the real headline. Employer NI is at 71% for reliefs and the employment
allowance.

### What is still not grounded

Worth being honest about, because it is the obvious place to improve next:

- **Demography is three stylised stocks** (child, working-age, old), not a full
  age-cohort model. Fertility is now policy-movable (`fertility` channel + a thin
  welfare link); a full age structure is not.
- **Housing–credit feedback is thin.** Price crashes lift PD and spreads into
  investment, but there is still no rich household balance-sheet / full credit
  cycle.
- **Banking is thin.** Endogenous `bankStress` (leverage + thin capital) is the
  default crisis path; the scripted `bank` event is narrowly gated. NIM, loan
  losses and spreads exist, but crises are not a full leverage cycle.
- **`privateWealth` is now live** (feeds consumption and credit collateral) but
  remains a single aggregate, not a full HH portfolio.
- **The social layer is invented.** Services, crime, liberty, environment,
  inequality and the black market are linear responses with plausible signs and
  no empirical calibration behind their coefficients.
- **The political layer is invented.** Faction approval, political capital and
  election thresholds are game design, not political science. They are the least
  defensible part of the model and are meant to be.

Trend growth is growth accounting: shared `TFP_FRONTIER` plus catch-up from
relative income `yRel`, knowledge/openness/trade, and labour from demography
(`migBase`, youth ratio) — not per-realm `tfpTrend` / `labourTrend` tables.
`NATION_PROFILE.trend` is a test-band target only.

### Calibration

`test/calibration.js` audits the model against ready-reckoner bands and fails
if anything drifts beyond roughly a third either way. It checks receipt levels,
marginal revenue per point, fiscal multiplier ordering (purchases > transfers >
tax cuts, via peak output gap), employer NI → NAIRU, dual capital rates, and
incidence ordering (transfers / allowance vs rate cuts).
`pnpm test` runs smoke then calibration.

## Impact analysis

Sandbox turns on full disclosure of what everything does, and all of it is
derived from the model rather than described alongside it:

- `simulate(law, quarters)` runs any law forward from today deterministically
  without touching live state. `project()` is now just `simulate(G.draft, n)`.
- `lawWithOnlyClause(i)` returns the law you would have if only clause *i*
  passed. It clones the draft and undoes every *other* clause, so it reuses the
  bill's own machinery instead of a parallel description that could drift.
- `impactOf(law, baseline, quarters)` diffs the two projections across the
  headline indicators (including **Trend growth** and **Potential**), all six
  factions, inequality, and on-impact receipts.
- `previewOption(opt, base)` shows what an event choice would do. Options mutate
  `G` directly, so it snapshots every field in `MUTABLE`, runs the option,
  measures, and restores. **A test asserts the game is byte-identical after
  previewing all 36 event options.** If you add mutable top-level state to `G`,
  add it to `MUTABLE` or previews will silently leak.

`impactStripHtml()` puts a running total at the top of the Budget, Taxes,
Policies, Society and Trade drawers, so the consequence of a change is visible
in the panel where the change was made. Cards also print their complete effect
list in sandbox rather than the top-two-and-worst summary, via `fullEffects()`.

The per-clause panel costs one 4-quarter simulation per clause plus two. That is
cheap, but it only runs when the bill drawer is open and sandbox is on.

## National insurance

Two rates and nothing else: `ni.empRate` and `ni.erRate`, each abolishable via
`ni.empOn` / `ni.erOn`. Real NI has its own thresholds and an upper earnings
limit, and an earlier version modelled them, but they duplicated the income tax
bands the player already controls. NI now simply starts where income tax starts
(`effectiveBands(law)[0].from`), so the personal allowance is the single floor
for all three taxes.

What survives is the part that is genuinely distinct, and it is the reason NI is
modelled separately at all: **incidence**. The employee side comes out of the
pay packet and hits worker approval. The employer side taxes the job, so it
feeds `nairu` and prices instead. Roughly 0.06 points of structural unemployment
per point of employer rate.

Dropping the upper earnings limit cost the one lever that made NI regressive at
the top. If that mechanic is wanted back, it belongs in the income tax bands
rather than as a second parallel threshold system.

## Backlog

Unbuilt ideas, roughly in order of how much they would add:

- Regional breakdown, so spending has geography and elections have marginal seats
- Parliament: bills passing on faction support rather than a single capital
  pool, with rebellions
- Save and load via `localStorage` (note: unavailable inside Claude artifacts,
  fine in a real browser)
- Difficulty settings, starting from different fiscal inheritances
- Fuller age-cohort demography (fertility is already a policy channel)
- The file is now large. Splitting would help editing but would break playing
  the reference `chancellor.html` as a single artifact. Do not split it without
  a reason better than tidiness.

Already in the live engine (do not treat as missing): FX and bilateral trade,
housing stock-flow with house-price → credit feedback, endogenous bank stress,
cohort demography stocks with policy fertility, human-capital stock `hCap`,
£100k allowance taper, real triple lock via `pensionIndex`, dividend/savings/dual
capital rates, private financial wealth in C and credit, consistent opening
settle, knowledge stock `R` from the research budget (and research-credit
effort) feeding TFP growth, derived trend (frontier + `yRel` catch-up +
demography, not per-realm tfp/labour tables), partner opening macros calibrated
to IMF WEO / Fiscal Monitor April 2026 (euro area, US, China, Russia / Northern
Reach, India / Lotus Republic, Africa / Afro Compact, LatAm / Liberdade Bloc,
AU/NZ Commonwealth, GCC).
