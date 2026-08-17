"use client";

import { CHAMBER_SEATS } from "../../lib/sim/engine.ts";

export interface ChamberPartyRow {
  id: string;
  name: string;
  short: string;
  color: string;
  seats: number;
  aye: number;
  nay: number;
  ruling: boolean;
  stance?: string;
}

export interface ChamberVoteView {
  needed: boolean;
  advisory: boolean;
  pass: boolean;
  aye: number;
  nay: number;
  following?: boolean;
  powers?: string;
  parties: ChamberPartyRow[];
  whipSpend?: number;
  whipBoost?: number;
}

/** Left-to-right on the hemicycle — same ideology order as the statute book. */
const ARC_ORDER = ["social", "liberal", "agrarian", "conservative", "national"];

type SeatDot = {
  x: number;
  y: number;
  color: string;
  aye: boolean;
  partyId: string;
};

function rowCounts(n: number, rows: number) {
  if (n <= 0) return Array.from({ length: rows }, () => 0);
  const weights = Array.from({ length: rows }, (_, i) => 2.4 + i);
  const sum = weights.reduce((a, b) => a + b, 0);
  const counts: number[] = [];
  let used = 0;
  for (let i = 0; i < rows - 1; i++) {
    const c = Math.max(1, Math.round((n * weights[i]) / sum));
    counts.push(c);
    used += c;
  }
  let last = n - used;
  if (last < 0) {
    for (let i = counts.length - 1; i >= 0 && last < 0; i--) {
      const take = Math.min(Math.max(0, counts[i] - 1), -last);
      counts[i] -= take;
      last += take;
    }
  }
  counts.push(Math.max(0, last));
  return counts;
}

function hemicyclePoints(n: number, rows = 6) {
  const inner = 2.35;
  const gap = 1;
  const counts = rowCounts(n, rows);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < rows; i++) {
    const count = counts[i];
    const r = inner + i * gap;
    for (let j = 0; j < count; j++) {
      const t = count <= 1 ? 0.5 : j / (count - 1);
      const angle = Math.PI * (1 - t);
      pts.push({ x: r * Math.cos(angle), y: -r * Math.sin(angle) });
    }
  }
  pts.sort((a, b) => a.x - b.x || b.y - a.y);
  return { pts, maxR: inner + (rows - 1) * gap };
}

function seatDots(parties: ChamberPartyRow[], mode: "vote" | "composition"): SeatDot[] {
  const total = Math.max(
    1,
    parties.reduce((s, p) => s + Math.max(0, p.seats), 0),
  );
  const { pts } = hemicyclePoints(total);
  const ordered = [...parties]
    .filter((p) => p.seats > 0)
    .sort((a, b) => ARC_ORDER.indexOf(a.id) - ARC_ORDER.indexOf(b.id));
  const dots: SeatDot[] = [];
  let i = 0;
  for (const p of ordered) {
    const ayeN = mode === "composition" ? p.seats : Math.max(0, p.aye);
    for (let s = 0; s < p.seats && i < pts.length; s++, i++) {
      dots.push({
        x: pts[i].x,
        y: pts[i].y,
        color: p.color,
        aye: s < ayeN,
        partyId: p.id,
      });
    }
  }
  return dots;
}

export function ChamberSeating({
  parties,
  mode = "vote",
  className = "",
}: {
  parties: ChamberPartyRow[];
  mode?: "vote" | "composition";
  className?: string;
}) {
  const present = parties.filter((p) => p.seats > 0);
  if (!present.length) return null;
  const total = present.reduce((s, p) => s + p.seats, 0);
  const { maxR } = hemicyclePoints(total);
  const dots = seatDots(present, mode);
  const pad = 0.85;
  const vb = `${-maxR - pad} ${-maxR - pad} ${(maxR + pad) * 2} ${maxR + pad + 0.35}`;
  const r = 0.38;
  return (
    <svg
      viewBox={vb}
      className={`block w-full ${className}`}
      role="img"
      aria-label="Chamber seating"
    >
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={r}
          fill={d.aye ? d.color : "transparent"}
          stroke={d.color}
          strokeWidth={d.aye ? 0 : 0.16}
          opacity={d.aye ? 1 : 0.85}
        />
      ))}
    </svg>
  );
}

export function ChamberVoteBar({ vote }: { vote: ChamberVoteView | null }) {
  if (!vote || !vote.needed || !vote.parties.length) return null;
  const total = Math.max(1, vote.aye + vote.nay);
  const ayePct = (vote.aye / total) * 100;
  const needed = Math.floor(CHAMBER_SEATS / 2) + 1;
  return (
    <div className="mb-3 rounded-md border border-frame bg-accent-dim px-2.75 py-2.25">
      <div className="mb-1.5 flex items-baseline gap-2 text-xs font-bold tracking-[.06em] text-ink-soft uppercase">
        <span>{vote.advisory ? "Assembly (advisory)" : "The chamber"}</span>
        <span
          className={`ml-auto font-[650] tracking-normal normal-case ${vote.pass ? "text-green-lt" : "text-red-lt"}`}
        >
          {vote.aye}–{vote.nay}
          {vote.pass ? " pass" : " no majority"}
        </span>
      </div>
      <ChamberSeating parties={vote.parties} mode="vote" className="mx-auto max-w-80" />
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-g-1">
        <div
          className="h-full bg-green"
          style={{ width: `${ayePct}%` }}
          title={`Aye ${vote.aye}`}
        />
        <div
          className="h-full bg-red"
          style={{ width: `${100 - ayePct}%` }}
          title={`Nay ${vote.nay}`}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.75 text-xs text-ink-faint">
        {vote.parties
          .filter((p) => p.seats > 0)
          .map((p) => (
            <span key={p.id}>
              <span
                className="mr-1 inline-block size-1.5 rounded-full align-middle"
                style={{ background: p.color }}
              />
              <span className="font-[650] text-ink-soft">
                {p.short}
                {p.ruling ? " · you" : ""}
              </span>{" "}
              {p.aye}–{p.nay}
            </span>
          ))}
      </div>
      {vote.following ? (
        <div className="mt-1 text-xs text-accent-lt">
          {vote.whipSpend
            ? "Your whip is pulling rebels toward aye."
            : "Your party is following you."}
        </div>
      ) : null}
      <div className="mt-0.5 text-xs text-ink-faint">
        Filled seats are aye, rings are nay. Need {needed} of {CHAMBER_SEATS}
        {vote.advisory ? " — this assembly cannot bind you" : ""}.
      </div>
    </div>
  );
}
