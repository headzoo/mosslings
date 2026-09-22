"use client";

import { useEffect, useRef } from "react";
import { seasonDimAt } from "@/lib/game-time";
import type { FramePainter } from "./useGodWorld";

export function SeasonDim({
  elapsed,
  subscribeFrame,
}: {
  elapsed: () => number;
  subscribeFrame: (painter: FramePainter) => () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  useEffect(() => {
    const overlay = ref.current;
    if (!overlay) return;
    return subscribeFrame(() => {
      overlay.style.opacity = String(seasonDimAt(elapsedRef.current()));
    });
  }, [subscribeFrame]);
  return <div ref={ref} className="season-dim" aria-hidden="true" />;
}
