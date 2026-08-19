"use client";

import { BOARD_METRICS } from "../../lib/sim/boardMetrics.ts";
import { SegControl } from "../ui/SegControl.tsx";

interface MapChromeProps {
  mapMetric: string;
  onMetricChange: (metric: string) => void;
}

export function MapChrome({ mapMetric, onMetricChange }: MapChromeProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-23 z-5 flex flex-col items-center gap-2 px-1.5 max-lg:bottom-(--drawer-bottom,calc(128px+env(safe-area-inset-bottom,0px))) max-lg:gap-1.5 max-sm:bottom-(--drawer-bottom,calc(118px+env(safe-area-inset-bottom,0px)))">
      <div
        id="mapMetrics"
        className="pointer-events-auto w-[min(420px,92vw)] flex-none rounded-sm border border-edge bg-panel shadow-spec backdrop-blur-md backdrop-saturate-130 max-md:max-w-none max-sm:w-full"
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
