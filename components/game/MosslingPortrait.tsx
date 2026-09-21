"use client";

import { useEffect, useRef, useState } from "react";
import type { PreviewMossling } from "@/lib/map-preview";
import {
  loadPortraitBase,
  PORTRAIT_SIZE,
  skinPortrait,
} from "@/lib/mossling-portrait";

export function MosslingPortrait({
  mossling,
  elapsed,
}: {
  mossling: PreviewMossling;
  elapsed?: () => number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mosslingRef = useRef(mossling);
  const elapsedRef = useRef(elapsed);
  mosslingRef.current = mossling;
  elapsedRef.current = elapsed;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    let base: ImageData | undefined;
    const paint = () => {
      if (!base || !ref.current) return;
      ref.current
        .getContext("2d")
        ?.putImageData(
          skinPortrait(base, mosslingRef.current, elapsedRef.current?.() ?? 0),
          0,
          0,
        );
    };
    loadPortraitBase()
      .then((image) => {
        if (cancelled) return;
        base = image;
        paint();
        if (!mossling.ritual) return;
        const loop = () => {
          paint();
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [mossling]);
  if (failed)
    return <span className="mossling-portrait">Portrait unavailable</span>;
  return (
    <canvas
      ref={ref}
      width={PORTRAIT_SIZE}
      height={PORTRAIT_SIZE}
      className="mossling-portrait"
      role="img"
      aria-label={`Pixel-art portrait of Mossling ${mossling.id + 1}, wearing its individual colors and pattern`}
    />
  );
}
