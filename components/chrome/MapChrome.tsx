"use client";

import { PARTNERS } from "../../lib/sim/engine.ts";
import {
  BOARD_METRICS,
  boardMetricBlocName,
  boardMetricValueLabel,
} from "../../lib/sim/boardMetrics.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { SegControl } from "../ui/SegControl.tsx";

interface MapChromeProps {
  mapMetric: string;
  selectedRole: string | null;
  onMetricChange: (metric: string) => void;
}

export function MapChrome({
  mapMetric,
  selectedRole,
  onMetricChange,
}: MapChromeProps) {
  const G = useGame();

  let labelContent;
  if (selectedRole === "home") {
    const note = (G.brief && G.brief[0]) || "Your economy";
    const fig =
      mapMetric === "blocs"
        ? boardMetricBlocName("home", G)
        : boardMetricValueLabel("home", mapMetric, G);
    labelContent = (
      <>
        <b>{G.country}</b>
        <span>
          {note}
          {fig ? ` · ${fig}` : ""}
        </span>
      </>
    );
  } else if (selectedRole) {
    const p = PARTNERS.find((x) => x.id === selectedRole);
    const fig =
      mapMetric === "blocs"
        ? boardMetricBlocName(selectedRole, G)
        : boardMetricValueLabel(selectedRole, mapMetric, G);
    const detail = fig
      ? `${fig} · economy card open`
      : `Relations ${Math.round(G.rel[selectedRole] ?? 50)} · economy card open`;
    labelContent = (
      <>
        <b>{p ? p.name : selectedRole}</b>
        <span>{detail}</span>
      </>
    );
  } else {
    labelContent = null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-23 z-5 flex flex-col items-center gap-2 px-3 max-md:bottom-(--drawer-bottom,calc(128px+env(safe-area-inset-bottom,0px))) max-md:gap-1.5 max-md:px-2 max-sm:bottom-(--drawer-bottom,calc(118px+env(safe-area-inset-bottom,0px)))">
      {labelContent && (
        <div
          id="mapLabel"
          className="pointer-events-none flex max-w-[94vw] flex-none flex-col items-center gap-px rounded-md border border-edge bg-panel px-3.5 py-1.5 text-center shadow-spec backdrop-blur-md backdrop-saturate-130 max-md:max-w-[calc(100vw-16px)] max-md:px-2.5 max-md:py-1.25 [&_b]:font-display [&_b]:text-[15px] [&_b]:font-normal [&_b]:tracking-[-.01em] max-md:[&_b]:text-[13px] [&_span]:text-[11px] [&_span]:tracking-[.02em] [&_span]:text-ink-soft max-md:[&_span]:line-clamp-2 max-md:[&_span]:text-[10px]"
        >
          {labelContent}
        </div>
      )}
      <div
        id="mapMetrics"
        className="pointer-events-auto w-[min(420px,92vw)] flex-none rounded-sm border border-edge bg-panel shadow-spec backdrop-blur-md backdrop-saturate-130 max-md:max-w-none"
      >
        <SegControl
          mini
          className="bg-transparent"
          value={mapMetric}
          options={BOARD_METRICS.map((m) => [m.id, m.name])}
          onChange={onMetricChange}
        />
      </div>
    </div>
  );
}
