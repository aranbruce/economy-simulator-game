"use client";

import { PARTNERS } from "../../lib/sim/engine.ts";
import {
  BOARD_METRICS,
  boardMetricBlocName,
  boardMetricCaption,
  boardMetricValueLabel,
} from "../../lib/sim/boardMetrics.ts";
import { useGame } from "../../lib/ui/useGame.ts";
import { SegControl } from "../ui/SegControl.tsx";

interface MapChromeProps {
  mapMetric: string;
  selectedRole: string | null;
  onMetricChange: (metric: string) => void;
}

export function MapChrome({ mapMetric, selectedRole, onMetricChange }: MapChromeProps) {
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
        <span>{note}{fig ? ` · ${fig}` : ""}</span>
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
    const caption = boardMetricCaption(mapMetric, G);
    labelContent = (
      <>
        <b>{G.country || "United Kingdom"}</b>
        <span>{caption || "Click a realm for its books"}</span>
      </>
    );
  }

  return (
    <div className="map-chrome">
      <div id="mapLabel">{labelContent}</div>
      <div
        id="mapMetrics"
        className="bg-panel backdrop-blur-md backdrop-saturate-130 border border-edge shadow-spec rounded-sm"
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
