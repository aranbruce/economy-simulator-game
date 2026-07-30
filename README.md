# Economy Simulator

A browser game where you are Chancellor of a fictional country. Set tax rates, departmental spending, legislation, vice law, tariffs and trade treaties — then watch a UK-calibrated macro model respond, one quarter at a time. Twenty quarters to an election.

**Play:** [economy-simulator-omega.vercel.app](https://economy-simulator-omega.vercel.app)

## Run locally

```bash
pnpm install
pnpm dev    # http://localhost:3000
pnpm test   # smoke + calibration
pnpm build
```

## How it works

Each turn is a quarter. You edit a **draft** budget and law; **Deliver** diffs it against what's in force, prices the bill in political capital, and advances the simulation.

The permanent backdrop is a fictional packed world map: your country plus the mapped trade-partner realms. If the map fails to load, the game falls back to a procedural country canvas. The map never owns game logic.

Sandbox mode (on by default) suppresses removal-from-office paths so you can experiment freely.

## Layout

| Path | Contains |
|---|---|
| `app/` | Next.js App Router, glass CSS |
| `components/` | Game shell, world map, UI |
| `lib/sim/` | Pure simulation engine (authoritative) |
| `public/geo/` | Natural Earth topojson |
| `test/` | Smoke and calibration suite |

## Stack

Next.js 15, React 19, no chart library — SVG charts and a canvas map only.
