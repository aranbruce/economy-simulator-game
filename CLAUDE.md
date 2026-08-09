# Economic simulator

A Next.js browser game. You are Chancellor of a fictional country, named by
the player and defaulting to "The Kingdom", and you run its economy through a macro model: tax rates and structures, departmental
spending, legislation, drug and vice law, tariffs and trade treaties. Each turn
is a quarter. Term length depends on the seat's polity (democracy/hybrid: twenty
quarters to an election or managed ballot; authoritarian: forty to a party
congress).

The permanent backdrop is a **fictional packed world map**: only your country
and the mapped trade-partner realms (real coastlines / silhouettes, invented
positions on a shared ocean). No other countries are drawn. If the map fails
to load, it falls back to a plain "could not load" message rather than a
second map implementation. The map never owns game logic.

The live app is Next.js App Router: UI in `components/`, pure sim in
`lib/sim/`.

## Commands

```bash
pnpm install
pnpm dev             # Next.js at http://localhost:3000
pnpm build           # production build
pnpm typecheck       # tsc --noEmit
pnpm test            # tsx test/sim.js && tsx test/calibration.js && ...
```

## TypeScript migration

The codebase is strict-typed `.ts`/`.tsx` throughout — every file under
`app/`, `components/` and `lib/` is `.ts`/`.tsx`, including
`lib/sim/engine.ts` (16.2k lines) and the three panels once deferred as
out-of-scope (`TaxesPanel`, `TradePanel`, `DiplomacyPanel` — see below).
`test/*.js` stay `.js` but run through the `tsx` runner rather than Next's
compiler. `strict: true` is on project-wide, and `pnpm typecheck` covers the
whole tree. `checkJs: false` remains set (harmless now that no `.js`/`.jsx`
app code exists to skip). Next.js's own compiler requires the classic
(non-native) TypeScript compiler API, so `typescript` is pinned to the last
6.x release rather than the 7.x native rewrite — do not bump past 6.x until
Next.js declares support. Standalone scripts (`test/`, `scripts/`) run via
`tsx` since they execute outside Next's compiler.

`engine.ts` was typed in a single flat-file pass rather than split along the
section banners below — getting it to compile clean under `strict: true` was
the goal, not a rearchitecture. Typing is deliberately loose at the legacy-JS
boundary: most function parameters and many locals are `any` or
`Record<string, any>` rather than precisely modelled, matching the
pragmatic-bulk-pass approach used for the rest of the migration.

**`lib/sim/statuteBook.ts`** (2k lines) is the one slice of "1. THE STATUTE
BOOK" that has been split out: `FACTIONS`, `DEPTS`, `TAXES`/`TAX_BY_ID`,
`REGIMES`/`REGIME_BY_ID`, `POLICIES`/`POLICY_BY_ID`, `VICE`/`VICE_BY_ID`,
`PARTNERS`, `MISSIONS`/`MISSION_BY_ID`, their derived `*Id` union types, and
the macro constants interleaved among them — verified line-by-line to have
zero reference to the live game state `G` before being moved, so the move is
a pure relocation with no behavioural change (confirmed byte-identical on
`pnpm test`, `pnpm balance` and `pnpm world-modes`). `engine.ts` imports these
back and re-exports them from its own barrel, so none of the ~30 external
consumers needed to change. The polity-transition helpers physically
interleaved with that data in the original section (`normalisePolityId`,
`polityOf`, `coupMetric`, `reviewStamp`, `careerHint`, and friends) reference
`G` directly and stay behind in `engine.ts`.

**The other eight sections are not split the same way, and a mechanical
per-banner split is not safe for them.** A structural audit found `aggregate()`,
`step()`, `billClauses()` and `despatch()` are each called from three or more
other sections, and the module-level `let G` global (declared in "2. STATE")
is read or written from nearly every function in the file. Splitting those
sections into separate files would need `G` refactored from a shared mutable
global into an explicitly-threaded context object first — a large,
high-risk rearchitecture of the calibration-critical core that has not been
attempted.

The diplomacy/ultimatum/bloc-accession/multiplayer-sync subsystem and the
polity-transition helpers physically interleaved with "1. THE STATUTE BOOK"
(`normalisePolityId`, `polityOf`, `coupMetric`, `reviewStamp`, `careerHint`,
and friends) were extracted to `lib/sim/diplomacyMp.ts` and reverted. The
extraction itself worked — every cross-boundary name resolved by
deletion-then-recompile against `tsc` rather than manual tracing, verified
byte-identical on `pnpm balance`/`pnpm world-modes`, a clean production
build, and a browser pass exercising the diplomacy drawer and a full quarter
advance — but it introduced the codebase's first circular module import
(`engine.ts` ⇄ `diplomacyMp.ts`, ~140 names one way and ~56 the other) for
an organisational win only (fewer lines in `engine.ts`, zero functional
change), which on reflection wasn't worth the permanent cost. Grand-strategy
sims with a similar shape — nations, diplomacy, a declarative event system —
tend to keep this kind of tightly-coupled simulation core as one unit for
exactly this reason (Paradox's own engineers describe their EU4/CK3/Stellaris
tick code as a monolith, deliberately). What stayed from the attempt: every
function that used to read the bare `G` binding directly now goes through
`getG()`/`setG()` instead, finishing a `g || G` fallback pattern
(`relationModifiers`, `processUltimatums`, and others already used it) that
used to be applied inconsistently across the subsystem, and the ~20
multiplayer swap-and-restore sites (`G = g; ...; G = prev;`, used to
temporarily mount another seat's data onto the same live object so
bare-`G`-reading helpers keep working) now go through `setG()` rather than a
raw reassignment. `setG(next)` sits beside the pre-existing `getG()`.
`MUTABLE` and `simulate()`'s own hand-spelled clone list are two
independently-maintained "fields a projection must carry forward" lists;
rather than force `simulate()` to build its object generically off
`MUTABLE` (unsafe — `law`/`draft`/`sandbox`/`rateManual`/`manualRate`/
`blocMember`/`customBlocs`/`world` are deliberately *not* plain clones of
`G` there, since running a hypothetical law forward is the entire point),
the 14 fields `simulate()` doesn't carry are on an explicit
`SIMULATE_OMITS` allowlist with a regression test (`test/sim.js`) that fails
if `MUTABLE` ever gains a field accounted for by neither list.

The documented section banners still describe the file's internal
organisation; note that surviving rendering functions (`TABS`, `lineChartSpec`,
etc. — the panel-painting functions `paintBillPanel`/`paintTaxesPanel`/
`paintTradePanel`/`paintDiplomacyPanel`/`paintPoliciesPanel`/`paintSocietyPanel`/
`paintChartsPanel`/`paintBudgetPanel` and their exclusive HTML-string helpers,
including the dead `chip()`/`leverHtml()`/`ctrlRow()`/`lineChart()` builders
they left behind, were deleted once every drawer was confirmed to render
through React — `renderChrome()`/`renderPanel()` remain only as no-op stubs,
see "Layout" below) live inside the "7a. The map" banner range, not the
"7. Rendering" one — a literal split-at-banners pass on the remaining eight
sections would otherwise also produce a mislabeled "map.ts" file that is
mostly UI rendering code, on top of the `G`-coupling problem above.

Alongside this, `dangerouslySetInnerHTML` usage fed by HTML-string functions
in `engine.ts` was replaced with real JSX fed by typed data-returning siblings
(`ledgerRows()`, `lineChartSpec()`, `impactStripData()`/`impactPanelData()`/
`rateImpactData()` with shared `impactChipsData()`/`impactFactionsData()`
(rendered via the shared `ImpactChips`/`ImpactFactions` components in
`components/ui/ImpactChips.tsx`), `fullEffectsData()`/`qualEffectsData()`,
`diploHudChips()`, `briefingData()` (via `components/chrome/BriefingBody.tsx`)
and the `gameOver()`/`termReview()` verdict payload (via
`components/chrome/VerdictBody.tsx`)). `despatch()`'s third argument accepts
either a plain HTML string or `{ kind: "briefing" | "verdict", data }`;
`DespatchModal.tsx` renders the matching typed component when `kind` is set
and falls back to `SafeHtml` only for freeform authored copy. That remaining
authored despatch/coach/event copy (small hand-built HTML with
`<p>`/`<b>`/`<em>`/`<span>` etc., covering the several hundred `EVENTS`
entries and the projection-forecast despatch) renders through
`components/ui/SafeHtml.tsx`, which parses with `DOMParser` (inert) and walks
the tree through an explicit tag allowlist — safe, and general enough to
cover arbitrary event bodies without hand-curating each one. Component
styling has moved from the hand-written CSS classes in `globals.css` to
Tailwind utilities — the glass/blur design language itself is unchanged, only
how it's expressed in markup; the remaining hand-written CSS in `globals.css`
is now limited to things Tailwind genuinely can't express (the backdrop-filter
glass recipe, the specular top-edge pseudo-element, newspaper-clipping press
styling, SVG chart styling) rather than reusable semantic utility classes.

**`TaxesPanel.tsx`, `TradePanel.tsx` and `DiplomacyPanel.tsx` were the last
three drawers converted, and needed a different treatment from the rest.**
Unlike every other drawer, they weren't React components with an isolated
`dangerouslySetInnerHTML` spot — each used to mount an empty div via
`EnginePaintHost` and let an imperative engine.ts function (`paintTaxesPanel`,
`paintTradePanel`, `paintDiplomacyPanel`) build and wire the whole panel by
hand (sliders, buttons, envoy/ultimatum controls, deal proposals, bloc
accession) via direct DOM manipulation. Converting them meant re-implementing
each panel's interactivity in React state/handlers rather than swapping a
render function's output format, so each got its own data-returning siblings
in `engine.ts` (`compositionBarData()`, `nationTableData()`,
`relationModifiersData()`, plus reused pure-logic exports like
`memberAccessionTrack()`, `blocInviteCandidates()`, `ultimatumDemandsFor()`)
and a set of mutate-then-`bump()` action wrappers in `lib/ui/actions.ts`
(`setDraftRegime`, `toggleDraftDeal`, `toggleBlocAccession`, `toggleMission`,
`assignEnvoyAction`, `issueUltimatumAction`, and friends). The
`paintTaxesPanel`/`paintTradePanel`/`paintDiplomacyPanel` functions, the
similarly-superseded `paintPoliciesPanel`/`paintSocietyPanel`/`paintChartsPanel`/
`paintBillPanel`/`paintBudgetPanel`, and every HTML-string helper exclusively
reachable from them (`partnerDiploCardHtml`, `relationModifiersHtml`,
`blocMembershipPanelHtml`, `wireLevers`, `incomePanelHtml`, and ~25 others —
2,778 lines in total) were confirmed unreachable via a per-function reference
audit (checked against every `.tsx` import and every remaining call site in
`engine.ts` itself) and deleted outright, rather than left in place as
documented dead code. `renderChrome()`/`renderPanel()` — the dispatcher
functions that used to call them — are kept as empty stubs since `render()`
still calls them unconditionally on every quarter advance; see "Layout" below.

**"Found a trade bloc" and "Invite a member" are real React too, and share
the despatch shell rather than owning their own modal chrome.**
`showBlocFoundModal()`/`showBlocInviteModal()` just call `setBlocModal(...)`
(engine-side state, mirroring `setOnDespatchChange`), which
`components/chrome/DespatchModal.tsx` reads and renders as
`<BlocFoundModalBody />` / `<BlocInviteModalBody bid={...} />` — genuine
typed components in `components/chrome/BlocModals.tsx` — inside the same
backdrop/header markup the despatch flow uses, conditionally in place of the
`open`-despatch body. Call `showBlocFoundModal()`/`showBlocInviteModal()`
directly (as `TradePanel`'s `onClick` handlers already do) rather than
duplicating this modal chrome inside a panel's own JSX — the despatch shell
is shared infrastructure, not something a single drawer should fork.

The broad Tailwind-utility migration is done: component styling has moved off
the hand-written semantic classes that used to live in `globals.css` (`chip`,
`panel`, `hint`, `eyebrow`, `lever`, `seg`, `btn`, `card`, and more — all
deleted once their last consumer converted) and onto small shared components
in `components/ui/` (`Chip.tsx`, `Typography.tsx`, `Lever.tsx`,
`SegControl.tsx`, `Button.tsx`, `Card.tsx`, `ImpactChips.tsx`, …) built from
Tailwind utilities. What's left in `globals.css` is what Tailwind genuinely
can't express as a utility: the backdrop-filter glass recipe, the specular
top-edge pseudo-element, the newspaper-clipping press skin, and SVG chart
styling. When touching a component, prefer a genuine dynamic value (a
computed bar-width `%`, a live colour) as an inline `style={{}}` prop over a
one-off Tailwind arbitrary-value class, matching the pattern already used
throughout `components/drawers/*.tsx` — but a *static* value should always be
a Tailwind class, never a hardcoded inline style.

## Architecture

| Path                             | Contains                                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                           | Next.js layout, page (client dynamic GameApp), glass CSS                                                                                                                           |
| `lib/sim/engine.ts`              | State, aggregate, step, project, bill, map, events, panel data                                                                                                                     |
| `lib/sim/statuteBook.ts`         | Pure content data split out of engine.ts: `TAXES`, `REGIMES`, `POLICIES`, `VICE`, `PARTNERS`, `DEPTS`, `FACTIONS`, `MISSIONS` and their macro-constant neighbours                  |
| `lib/sim/worldTrade.ts`          | Bilateral trade clearing across seats                                                                                                                                              |
| `lib/sim/fxAreas.ts`             | Currency-area Taylor rules and FX vs USD                                                                                                                                           |
| `lib/sim/partners.ts`            | Partner id → ISO country sets for the world map                                                                                                                                    |
| `components/game/GameApp.tsx`    | Shell: topbar, dock, drawer, despatch; wires the engine                                                                                                                            |
| `components/map2d/WorldMap.tsx`  | Flat world map, partner colours, click-to-trade. Also the fallback path: a canvas failure renders a plain "could not load" message rather than a separate procedural-map component |
| `public/geo/countries-110m.json` | Natural Earth topojson                                                                                                                                                             |

Engine sections still follow the numbered banners. Section 1's pure content
data now lives in `lib/sim/statuteBook.ts` (see "TypeScript migration"
above); sections 2–9 remain in `lib/sim/engine.ts`:

| Section             | Contains                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The statute book | All content data (`lib/sim/statuteBook.ts`): `TAXES`, `REGIMES`, `POLICIES`, `VICE`, `PARTNERS`, `DEPTS`, `FACTIONS`, `MISSIONS`. The polity-transition helpers physically interleaved with this data in the original section (`normalisePolityId`, `polityOf`, `coupMetric`, …) reference `G` and stay in `engine.ts` |
| 2. State            | `newGame()`, `baseLaw()`, the `G` global                                                                                                                         |
| 3. Aggregation      | `aggregate()`, `revenue()`, `spending()`, `balanceOf()`, `potentialGrowth()`, and the income tax engine                                                          |
| 4. The engine       | `step()` — one quarter of macro simulation                                                                                                                       |
| 5. Projection       | `project()`, `projectionWarnings()` — the pre-budget forecast                                                                                                    |
| 6. The bill         | `billClauses()` — diffs `G.draft` against `G.law` and prices each change                                                                                         |
| 7a. The map         | Rendering helpers (`TABS`, `lineChartSpec()`, …) — see the note above on the panel-painting functions this section used to also hold. The procedural-map data that gave the section its name (`REGIONS`, `initRegions()`, `stepRegions()`) has since been removed as unreferenced |
| 7. Rendering        | Tabs, sliders, cards, SVG charts                                                                                                                                 |
| 8. Despatches       | `EVENTS`, term reviews (election/congress), crises, game over                                                                                                    |
| 9. Flow             | `enact()`, `projectionModal()`, button wiring                                                                                                                    |

### Multi-country world

Every realm runs the same macro core via `stepCountry` / `stepWorldPartners`.
`G.world[id] = { econ, law, prevLaw }` holds full bags for AI seats; the player's
live `G.econ` remains canonical and is mirrored into `G.world[playerId]`.

- **Politics stay player-only** — AI seats use frozen `lawForRole` plus a light
  automatic fiscal rule; no bills, factions, or capital.
- **Polity lives on `law.polity`** (seeded from `NATION_PROFILE.polity`:
  democracy, hybrid, or authoritarian — Gulf openings use authoritarian).
  Partners and AI seats keep the profile pin; the player can restage any system
  from Society as a bill clause. Adjacent steps cost the target's `changePc`;
  leaping democracy ↔ authoritarian adds `POLITY_LEAP_EXTRA` (32). Democracy/
  hybrid run competitive or managed ballots on a 20-quarter clock; authoritarian
  seats use a 40-quarter party congress with a patriots-weighted score, regenerate
  political capital more slowly (`capitalRegen` 0.55), and face a sharper elite
  coup (patriots below 28 for three quarters). A polity change writes
  `G.polityShift`, hits factions via `billShock`, and can fire follow-up events
  (`polityBacklash` / `polityConsolidation` / `polityRecognition`). Bilateral
  relations pick up a `REL_POLITY` affinity term so similar regimes warm toward
  each other. Partner events such as `newGovt` use election / reshuffle copy
  from the focus seat's polity — never a general election in China or Saudi.
- **Trade** — `refreshWorldTrade` clears bilateral flows (`lib/sim/worldTrade.ts`);
  cleared flows phase into the player's expenditure block over about a year.
- **FX** — seats sharing `NATION_PROFILE.currency` share a Taylor rate and FX path
  vs USD (`lib/sim/fxAreas.ts`).
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

The world map is permanent scenery, not a tab. `WorldMap.tsx` sits at z-index
0. Everything else is React, floating over it:

- Topbar — country, term, and the stat chips (`components/chrome/TopBarStats.tsx`,
  built on `components/ui/Chip.tsx`)
- Dock — the bottom toolbar: one button per drawer, then the bill summary and
  the Deliver action, which shows the forecast and asks you to proceed.
- Drawer — a parchment sheet over the map, rendered by
  `components/chrome/DrawerContent.tsx` off the `tab` state in `engine.ts`
  (`getTab()`/`setTab()`), or nothing for the undisturbed map. On wide screens
  it docks to the right.

`engine.ts`'s own `renderChrome()`/`renderPanel()` are now empty no-op stubs —
every tab paints through its React component (`components/drawers/*.tsx` via
`DrawerContent.tsx`), and every stat chip through `TopBarStats.tsx`. They're
kept only because `render()` (still the live re-render trigger, called
throughout `GameApp.tsx`) calls them unconditionally; the `UI_REACT_CHROME`/
`UI_REACT_PANELS` flags that used to gate them were deleted outright once the
stubs became unconditional. Clicking a partner on the world map sets
`tab = "trade"`.

## The map

**The world map is a 2D canvas** (`components/map2d/WorldMap.tsx`) over
Natural Earth topojson (`public/geo/countries-110m.json`), coloured by
`lib/sim/boardMetrics.ts`. Trade partners appear as compass markers around the
edge, coloured by relations; clicking one sets `tab = "trade"`. Game logic
must not live in the map module. A canvas failure falls back to a plain
"could not load" message rendered by `WorldMap.tsx` itself — there is no
second map implementation to fall back to.

An earlier hand-rolled procedural country generator (radial-noise coastline,
nine regions carved by nearest seed, flood-filled ocean, `LOBES`/`ISLES`/
`LAKE`) lived in `engine.ts` and predates the Natural Earth map; it has been
removed now that nothing referenced it. `REGIONS`, `initRegions()` and
`stepRegions()` — the regional metadata (`mix`, `prosper`, `beta`, `trade`,
`publicShare`, `housing`) and the per-quarter approval/unemployment/prosperity
breakdown it fed — went with it once `econ.regions` had no remaining reader
either. A future "regional breakdown" feature (see Backlog) would need to
rebuild this from scratch.

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

A large share of the ordinary pool is foreign relations, which is where
the interesting bilateral consequences live: ultimatums over the digital services
tax, sanctions packages that force a choice between allies and cheap inputs,
bloc invitations, swap lines, migration deals, espionage.

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

`pnpm test` runs `test/sim.js` then `test/calibration.js`. Both import the
modular engine from `lib/sim/` directly (no DOM harness, no `index.html`
extract). Despatches and events are exercised through engine exports
(`autoDespatch`, `disableEvents` / `enableEvents`, and friends) so headless
runs can advance quarters without clicks.

Verdicts are deliberately **not** auto-clicked: that would call `newGame()`
and wipe the run under test. Balance A/B tests should keep events off, because
an event can legitimately overwrite the law under test.

Read the smoke and calibration output after any model change. Calibration fails
the build if ready-reckoners drift beyond band.

For a fuller long-run check, run `pnpm balance` (`scripts/balance-30y.mjs`):
ten playstyles over 120 quarters (30 years). For all-AI vs all-human world
modes, run `pnpm world-modes`.

## Design

iOS Liquid Glass over a dark planet. Translucent surfaces
(`backdrop-filter: blur(32px) saturate(190%)`), a specular top edge on every
raised element (`--spec`), generous concentric radii, and iOS system colours
(`--blue #0A84FF`, `--green #30D158`, `--red #FF453A`, `--amber #FF9F0A`).
Depth comes from blur and stacking, never from heavy borders.

Type is `-apple-system` first, so it renders in real SF Pro on Apple hardware
and falls back to Inter elsewhere. There is no monospace: `--mono` aliases the
sans stack and figures align via `font-variant-numeric: tabular-nums`.

Only two variables are still referenced from a JS template string (`--ink-soft`,
`--mono`, both in `projectionModal()`'s forecast despatch body — the one
remaining despatch not yet converted off `SafeHtml`, alongside the freeform
`EVENTS` copy), so the stylesheet can be rewritten freely provided those keep
working. Chart colours live in `COL` in the JS and the world map's partner
accents in `relationColour()`; both follow the same system palette and must be
changed together with the CSS.

Charts are hand-rolled SVG, built from `lineChartSpec()`'s point/series data
and rendered as real JSX in `components/drawers/ChartsPanel.tsx`. No chart
library, deliberately, so the file stays dependency-free.

## Rules and sandbox

`G.sandbox` (**on by default**) suppresses every removal-from-office path:
term-review defeat, an elite coup (democracy/hybrid: four quarters below 20%
approval; authoritarian: three quarters below 28% patriots), and the
terminal debt and inflation crises. The crisis still fires and still reports
itself in the briefing; you simply keep the job. `gameOver()` returns early and
`termReview()` / `election()` returns you regardless. Toggle it at the foot of
the bill drawer.

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
  and set against _trend_ output, since spending plans are made in advance.
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

Trend growth comes out near 1.3-1.5% a year, which is the right order for the
UK, and it is derived rather than set. `impliedLabourGrowth()` must mirror the
cohort arithmetic of the demography block in `step()` (ageing-in, ageing-out,
migration, less the `ageingLabourDrag` participation drag): trend growth and
Okun's law both benchmark against it, so any wedge between it and the simulated
labour force shows up as a permanent unemployment drift and a mispriced trend.

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

**Ageing.** `dependency` drifts from 0.30 to about 0.38-0.40 over thirty years
(ONS-style, with the working-age stock roughly flat at baseline migration),
raising health demand (`AGEING_HEALTH`) and pension caseload, and dragging on
labour force growth through `ageingLabourDrag`.

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
With it, the gap stays small, net trade settles near −3% and trend growth
comes out near 1.4% a year.

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

| basis       | taxes                               | behaviour                     |
| ----------- | ----------------------------------- | ----------------------------- |
| consumption | VAT, all the duties                 | tracks C, not Y               |
| profits     | corporation tax, windfall, digital  | swings 2.6x as hard as output |
| assets      | CGT, inheritance, wealth, land, FTT | discounted at the real rate   |
| volume      | fuel duty                           | physically shrinking base     |
| wages       | income tax, NI                      | the wage bill                 |

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

Demography is live (cohort stocks, dependency 0.30 → ~0.39 over thirty years),
so the decay bundles Baumol with ageing, which is the same mix inside the 1 to
1.5% usually quoted for health.

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

|                    | model        | UK    |
| ------------------ | ------------ | ----- |
| Receipts           | 40.4% of GDP | 40.4% |
| Spending           | 44.9%        | 44.8% |
| Deficit            | 4.5%         | 4.4%  |
| Debt               | 94%          | 94.3% |
| Income tax         | 10.8%        | 10.8% |
| National insurance | 6.5%         | ~6.3% |
| VAT                | 5.9%         | 5.9%  |
| Corporation tax    | 3.3%         | 3.2%  |
| Consumption        | 61%          | ~61%  |
| Government         | 22%          | ~22%  |

Opening macro state is UK mid-2026: Bank rate 3.75%, CPI 2.9%, unemployment
4.9% against an equilibrium of 4.1%, gilt yield 4.6%.

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
- `lawWithOnlyClause(i)` returns the law you would have if only clause _i_
  passed. It clones the draft and undoes every _other_ clause, so it reuses the
  bill's own machinery instead of a parallel description that could drift.
- `impactOf(law, baseline, quarters)` diffs the two projections across the
  headline indicators (including **Trend growth** and **Potential**), all six
  factions, inequality, and on-impact receipts.
- `previewOption(opt, base)` shows what an event choice would do (feeds the
  live impact-preview UI). Options mutate `G` directly, so it snapshots every
  field in `MUTABLE`, runs the option, measures via `impactOf()`, and
  restores. **A test exercises every one of `EVENTS`' 110 options (across 37
  events) the same way** — `applyEventOption()` directly, `MUTABLE`
  snapshot/restore inline, asserting no option leaves a banned `growth`/
  `inflation` mod key — though that test doesn't call `previewOption()`
  itself or assert full byte-identical state, just that the banned keys never
  leak (`test/sim.js`). If you add mutable top-level state to `G`, add it to
  `MUTABLE` or both `previewOption()` and this test will silently leak it.

`impactStripData()` puts a running total at the top of the bill drawer, so the
consequence of staged changes is visible alongside the clause list. Cards also
print their complete effect list in sandbox rather than the top-two-and-worst
summary, via `fullEffectsData()`.

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

Already in the live engine (do not treat as missing): FX and bilateral trade,
housing stock-flow with house-price → credit feedback, endogenous bank stress,
cohort demography stocks with policy fertility, human-capital stock `hCap`,
£100k allowance taper, real triple lock via `pensionIndex`, dividend/savings/dual
capital rates, private financial wealth in C and credit, consistent opening
settle, knowledge stock `R` from the research budget (and research-credit
effort) feeding TFP growth, derived trend (frontier + `yRel` catch-up +
demography, not per-realm tfp/labour tables), partner opening macros calibrated
to IMF WEO / Fiscal Monitor April 2026 across the sovereign seats.
