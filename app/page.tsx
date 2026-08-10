"use client";

import dynamic from "next/dynamic";

const GameApp = dynamic(() => import("../components/game/GameApp"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-dvh place-items-center bg-[#04060b] font-[system-ui,sans-serif] text-[15px] text-white/55">
      Loading…
    </div>
  ),
});

export default function HomePage() {
  return <GameApp />;
}
