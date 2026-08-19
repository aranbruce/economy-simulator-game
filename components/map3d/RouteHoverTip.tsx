"use client";

import { FlagAvatar } from "../ui/FlagAvatar.tsx";

/** One directed (or undirected fallback) flow through the hovered water. */
export interface HoverPairRow {
  id: string;
  fromRole: string;
  fromLabel: string;
  toRole: string;
  toLabel: string;
  /** Share of traffic at this point (0–1). */
  share: number;
  /** Directed flow in the player's display currency. */
  amount: string;
}

export interface RouteHoverTipProps {
  pairs: HoverPairRow[] | null;
}

function pct(n: number) {
  return Math.round(n * 100) + "%";
}

const TH =
  "border-b border-white/10 pb-1 pr-2.5 text-left text-[10px] font-bold tracking-[.08em] text-[#d4af69] uppercase";
const TD = "py-1 pr-2.5 align-middle text-xs text-[#f6f0e2]";
const TD_NUM =
  "py-1 align-middle text-right text-xs tabular-nums text-[rgba(246,240,226,.7)]";

export default function RouteHoverTip({ pairs }: RouteHoverTipProps) {
  if (!pairs?.length) return null;
  const extra = pairs.length > 10 ? pairs.length - 10 : 0;
  const shown = extra ? pairs.slice(0, 10) : pairs;
  return (
    <div className="hud-surface pointer-events-none min-w-64 px-3 py-2">
      <div className="text-[10px] font-bold tracking-[.12em] text-[#d4af69] uppercase">
        Traffic at this point
      </div>
      <table className="mt-1.5 w-full border-collapse">
        <thead>
          <tr>
            <th className={TH}>From → to</th>
            <th className={`${TH} text-right`}>Amount</th>
            <th className={`${TH} pr-0 text-right`}>Share</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id}>
              <td className={TD}>
                <span className="inline-flex items-center gap-1.5">
                  <FlagAvatar role={p.fromRole} size="size-5" />
                  <span className="font-semibold">{p.fromLabel}</span>
                  <span className="text-[rgba(246,240,226,.4)]">→</span>
                  <FlagAvatar role={p.toRole} size="size-5" />
                  <span className="font-semibold">{p.toLabel}</span>
                </span>
              </td>
              <td className={`${TD_NUM} pr-2.5`}>{p.amount}</td>
              <td className={`${TD_NUM} pr-0`}>{pct(p.share)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {extra > 0 && (
        <div className="mt-1 text-[10px] text-[rgba(246,240,226,.45)]">
          +{extra} more
        </div>
      )}
    </div>
  );
}
