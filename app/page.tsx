"use client";

import dynamic from "next/dynamic";

const GameApp = dynamic(() => import("../components/game/GameApp"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: "100dvh",
        height: "100%",
        display: "grid",
        placeItems: "center",
        background: "#04060b",
        color: "rgba(255,255,255,.55)",
        fontFamily: "system-ui, sans-serif",
        fontSize: "15px",
      }}
    >
      Loading the cabinet…
    </div>
  ),
});

export default function HomePage() {
  return <GameApp />;
}
