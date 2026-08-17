"use client";

import { useMemo, useState } from "react";
import {
  closeDespatch,
  COMMERCIAL_ACCEPT_P,
  commercialPackageScore,
  previewSummitTariff,
  T,
} from "../../lib/sim/engine.ts";
import { Lever } from "../ui/Lever.tsx";
import { Hint } from "../ui/Typography.tsx";
import { SafeHtml } from "../ui/SafeHtml.tsx";

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function AcceptMeter({
  p,
  ok,
  pending,
  label = "Acceptance",
}: {
  p?: number;
  ok: boolean;
  pending?: boolean;
  label?: string;
}) {
  const pct = Math.round(clamp01(p ?? (ok ? 1 : 0)) * 100);
  const fill = pending
    ? "bg-ink-soft"
    : ok
      ? "bg-green"
      : pct >= COMMERCIAL_ACCEPT_P * 100 - 10
        ? "bg-amber"
        : "bg-red";
  const status = pending
    ? "They decide"
    : ok
      ? "Would accept"
      : "Would decline";
  return (
    <div className="mt-1.5">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-faint">{label}</span>
        <span
          className={
            pending ? "text-ink-soft" : ok ? "text-green-lt" : "text-red-lt"
          }
        >
          {pending ? status : pct + "% · " + status}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-xs border border-edge bg-g-1">
        <i
          className={`block h-full rounded-none transition-[width] duration-200 ${fill}`}
          style={{ width: `${pending ? 50 : pct}%` }}
        />
        <i
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/45"
          style={{ left: `${COMMERCIAL_ACCEPT_P * 100}%` }}
          title="Accept threshold"
        />
      </div>
    </div>
  );
}

function TariffMoveRow({
  label,
  from,
  to,
  scale,
}: {
  label: string;
  from: number;
  to: number;
  scale: number;
}) {
  const fromR = Math.round(from);
  const toR = Math.round(to);
  const cut = Math.max(0, fromR - toR);
  const fromPct = scale > 0 ? Math.min(100, (from / scale) * 100) : 0;
  const toPct = scale > 0 ? Math.min(100, (to / scale) * 100) : 0;
  return (
    <div className="border-b border-edge px-3 py-2.5 last:border-b-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs text-ink-faint">{label}</span>
        {cut > 0 ? (
          <span className="text-xs font-[650] text-green-lt">
            −{cut} pt{cut === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">unchanged</span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(2.75rem,auto)_1fr_minmax(2.75rem,auto)] items-center gap-2">
        <div>
          <div className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            Now
          </div>
          <b className="block text-base font-[650] tracking-[-.02em] tabular-nums">
            {fromR}%
          </b>
        </div>
        <div
          className="bg-g-0 relative h-2 overflow-hidden rounded-xs border border-edge"
          title={fromR + "% → " + toR + "%"}
        >
          <i
            className="absolute inset-y-0 left-0 bg-white/18"
            style={{ width: `${fromPct}%` }}
          />
          <i
            className="absolute inset-y-0 left-0 bg-green"
            style={{ width: `${toPct}%` }}
          />
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold tracking-wider text-ink-faint uppercase">
            After
          </div>
          <b className="block text-base font-[650] tracking-[-.02em] text-green-lt tabular-nums">
            {toR}%
          </b>
        </div>
      </div>
    </div>
  );
}

function InboundAgendaBody({ data }: { data: any }) {
  const deals = Array.isArray(data.deals) ? data.deals : [];
  const ourFrom = +data.ourFrom || 0;
  const ourTo = +data.ourTo || 0;
  const theirFrom = +data.theirFrom || 0;
  const theirTo = +data.theirTo || 0;
  const scale = Math.max(ourFrom, theirFrom, 1);
  const showTariffs = !!data.hasTariff;
  return (
    <>
      {data.intro ? <SafeHtml html={data.intro} /> : null}
      {data.hint ? <Hint className="mb-3">{T(data.hint)}</Hint> : null}
      {showTariffs ? (
        <div className="mb-3 overflow-hidden rounded-md border border-edge bg-g-1">
          <TariffMoveRow
            label={data.theirLabel || "Their duty on our goods"}
            from={theirFrom}
            to={theirTo}
            scale={scale}
          />
          <TariffMoveRow
            label={data.ourLabel || "Our duty on their goods"}
            from={ourFrom}
            to={ourTo}
            scale={scale}
          />
        </div>
      ) : null}
      {deals.length ? (
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-bold tracking-wider text-ink-faint uppercase">
            Treaties
          </div>
          <div className="grid gap-1.5">
            {deals.map((d: any) => (
              <div
                key={d.id || d.name}
                className="rounded-md border border-l-3 border-accent/40 border-l-accent bg-accent/10 px-3 py-2.5 text-sm"
              >
                <b className="block font-[650] tracking-[-.02em]">{d.name}</b>
                {Array.isArray(d.terms) && d.terms.length ? (
                  <ul className="mt-1.5 mb-0 list-disc pl-4 text-xs text-ink-soft">
                    {d.terms.map((t: string) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CommercialAgendaBody({
  data,
  optionClassName,
}: {
  data: any;
  optionClassName: string;
}) {
  if (data && data.inbound) return <InboundAgendaBody data={data} />;
  return <ProposeAgendaBody data={data} optionClassName={optionClassName} />;
}

function ProposeAgendaBody({
  data,
  optionClassName,
}: {
  data: any;
  optionClassName: string;
}) {
  const ourMax = Math.max(0, data.ourMax | 0);
  const theirMax = Math.max(0, data.theirMax | 0);
  const deals = Array.isArray(data.deals) ? data.deals : [];
  const [ourCut, setOurCut] = useState(() => Math.min(2, ourMax));
  const [theirCut, setTheirCut] = useState(() => Math.min(2, theirMax));
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const preview = useMemo(
    () => previewSummitTariff(data.partnerId, ourCut, theirCut),
    [data.partnerId, ourCut, theirCut],
  );
  const ourAfter = Math.max(0, (data.ourRate || 0) - ourCut);
  const theirAfter = Math.max(0, (data.theirRate || 0) - theirCut);
  const hasCuts = ourCut > 0 || theirCut > 0;
  const pending = "pending" in preview && !!preview.pending;
  const gift = ourCut > theirCut;
  const pickedDealRows = deals.filter((d: any) => d && selected[d.id]);
  const pickedDeals = pickedDealRows.map((d: any) => d.id);
  const parts = [
    hasCuts
      ? {
          p: typeof preview.p === "number" ? preview.p : preview.ok ? 1 : 0,
          ok: !!preview.ok,
          pending,
        }
      : null,
    ...pickedDealRows.map((d: any) => ({
      p: typeof d.p === "number" ? d.p : d.ok ? 1 : 0,
      ok: !!d.ok,
      pending: !!d.pending,
    })),
  ].filter(Boolean) as { p: number; ok: boolean; pending?: boolean }[];
  const overall = commercialPackageScore(parts);
  const canPropose =
    parts.length > 0 &&
    overall.ok &&
    !data.union?.blocked &&
    typeof data.onPropose === "function";
  const union = data.union;
  const ourCutLabel = union
    ? "Our cut on " + (union.name || "the union")
    : "Our cut on " + (data.partnerName || "them");
  const theirCutLabel = union ? "Union cut on us" : "Their cut on us";

  return (
    <>
      {data.intro ? <SafeHtml html={data.intro} /> : null}
      {data.hint ? <Hint className="mb-3">{T(data.hint)}</Hint> : null}
      {union && union.approvals && union.approvals.length ? (
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-bold tracking-wider text-ink-faint uppercase">
            Member approval
          </div>
          {union.approvals.map((a: any) => (
            <div
              key={a.id}
              className="my-0.75 grid grid-cols-[90px_1fr_36px] items-center gap-2 text-xs"
            >
              <span>{a.name}</span>
              <span className="h-1.25 overflow-hidden rounded-xs border border-edge bg-g-1">
                <i
                  className={`block h-full rounded-none ${a.ok ? "bg-green" : "bg-red"}`}
                  style={{ width: `${Math.round(a.rel)}%` }}
                />
              </span>
              <span
                className={`text-right font-[650] ${a.ok ? "text-green" : "text-red"}`}
              >
                {Math.round(a.rel)}
              </span>
            </div>
          ))}
          {union.blocked && union.blockReason ? (
            <div className="mt-1.5 text-xs text-red">{union.blockReason}</div>
          ) : null}
        </div>
      ) : null}
      {data.canNegotiate ? (
        <div className="mb-3 overflow-hidden rounded-md border border-edge bg-g-1">
          <Lever
            id="summit-our-cut"
            name={ourCutLabel}
            value={ourCut}
            min={0}
            max={ourMax}
            step={1}
            decimals={0}
            format={(v) =>
              "−" + Math.round(v) + " pt" + (Math.round(v) === 1 ? "" : "s")
            }
            note={
              Math.round(data.ourRate || 0) +
              "% → " +
              Math.round(ourAfter) +
              "%"
            }
            onInput={(_id, v) => setOurCut(Math.round(v))}
            onCommit={(_id, v) => setOurCut(Math.round(v))}
          />
          <Lever
            id="summit-their-cut"
            name={theirCutLabel}
            value={theirCut}
            min={0}
            max={theirMax}
            step={1}
            decimals={0}
            format={(v) =>
              "−" + Math.round(v) + " pt" + (Math.round(v) === 1 ? "" : "s")
            }
            note={
              Math.round(data.theirRate || 0) +
              "% → " +
              Math.round(theirAfter) +
              "%"
            }
            onInput={(_id, v) => setTheirCut(Math.round(v))}
            onCommit={(_id, v) => setTheirCut(Math.round(v))}
          />
          {(!hasCuts ||
            (gift && hasCuts && !pending) ||
            (hasCuts && !overall.ok && preview.reason)) && (
            <div className="border-t border-edge px-3 py-2">
              {gift && hasCuts && !pending ? (
                <div className="text-xs text-green-lt">
                  Offering more than you ask improves acceptance.
                </div>
              ) : null}
              {hasCuts && !overall.ok && preview.reason ? (
                <div
                  className={`text-xs text-ink-soft ${gift && !pending ? "mt-1" : ""}`}
                >
                  {preview.reason}
                </div>
              ) : !hasCuts ? (
                <div className="text-xs text-ink-faint">
                  Set a cut, or table a treaty, to see whether they would
                  accept.
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {deals.length ? (
        <div className="mb-3">
          <div className="mb-1.5 text-xs font-bold tracking-wider text-ink-faint uppercase">
            Treaties
          </div>
          <div className="grid gap-1.5">
            {deals.map((d: any) => {
              const on = !!selected[d.id];
              return (
                <button
                  key={d.id}
                  type="button"
                  className={
                    "rounded-md border border-l-3 px-3 py-2.5 text-left text-sm transition duration-160 " +
                    (on
                      ? "border-accent/40 border-l-accent bg-accent/10"
                      : "border-edge border-l-transparent bg-g-1 hover:border-l-accent hover:bg-white/7")
                  }
                  onClick={() => {
                    setSelected((prev) => ({ ...prev, [d.id]: !prev[d.id] }));
                  }}
                >
                  <b className="block font-[650] tracking-[-.02em]">
                    {on ? "Include · " : "Add · "}
                    {d.name}
                  </b>
                  {d.reason ? (
                    <em className="mt-1 block text-xs text-ink-soft not-italic">
                      {d.reason}
                    </em>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={optionClassName + " mb-1 w-full"}
        disabled={!canPropose}
        onClick={() => {
          if (!canPropose) return;
          closeDespatch();
          data.onPropose(ourCut, theirCut, pickedDeals);
        }}
      >
        <b className="block font-[650] tracking-[-.02em]">
          Conclude this agenda
        </b>
        <em className="mt-0.75 block text-xs text-ink-soft not-italic">
          {[
            hasCuts ? "We cut " + ourCut + " · they cut " + theirCut : null,
            pickedDeals.length
              ? pickedDeals.length === 1
                ? "1 treaty"
                : pickedDeals.length + " treaties"
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Nothing selected"}
        </em>
        {parts.length ? (
          <AcceptMeter
            p={overall.p}
            ok={!!overall.ok}
            pending={!!overall.pending}
            label="Acceptance"
          />
        ) : null}
      </button>
    </>
  );
}
