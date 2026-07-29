"use client";

import { PARTNERS } from "../../lib/sim/engine.js";
import {
  BOARD_METRICS,
  boardMetricBlocName,
  boardMetricCaption,
  boardMetricValueLabel,
} from "../../lib/sim/boardMetrics.js";
import { useGame } from "../../lib/ui/useGame.js";
import { SegControl } from "../ui/SegControl.jsx";

export function MapChrome({ mapMetric, selectedRole, onMetricChange }) {
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
      <div id="mapMetrics">
        <SegControl
          mini
          value={mapMetric}
          options={BOARD_METRICS.map((m) => [m.id, m.name])}
          onChange={onMetricChange}
        />
      </div>
    </div>
  );
}
