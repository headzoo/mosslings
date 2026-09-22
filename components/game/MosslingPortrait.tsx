"use client";

import { useEffect, useRef, useState } from "react";
import type { PreviewMossling } from "@/lib/map-preview";
import {
  loadPortraitBackdrop,
  loadPortraitFrames,
  PORTRAIT_FRAME_COUNT,
  PORTRAIT_SIZE,
  portraitBounceFrame,
  portraitLookKey,
  skinPortrait,
} from "@/lib/mossling-portrait";

export function MosslingPortrait({
  mossling,
  elapsed = () => 0,
}: {
  mossling: PreviewMossling;
  elapsed?: () => number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  const mosslingRef = useRef(mossling);
  elapsedRef.current = elapsed;
  mosslingRef.current = mossling;
  const [failed, setFailed] = useState(false);
  const look = portraitLookKey(mossling);
  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    Promise.all([
      loadPortraitFrames(),
      loadPortraitBackdrop().catch(() => null),
    ])
      .then(([frames, backdrop]) => {
        if (cancelled || !ref.current) return;
        if (portraitLookKey(mosslingRef.current) !== look) return;
        const context = ref.current.getContext("2d");
        if (!context) return;
        const sheet = document.createElement("canvas");
        sheet.width = PORTRAIT_SIZE;
        sheet.height = PORTRAIT_SIZE * PORTRAIT_FRAME_COUNT;
        const sprite = sheet.getContext("2d");
        if (!sprite) return;
        const current = mosslingRef.current;
        for (let frame = 0; frame < frames.length; frame++) {
          const image = frames[frame];
          if (!image) continue;
          sprite.putImageData(
            skinPortrait(image, current),
            0,
            frame * PORTRAIT_SIZE,
          );
        }
        const render = () => {
          const shown = mosslingRef.current;
          const bounce = portraitBounceFrame(
            shown.id,
            elapsedRef.current(),
            shown.health ?? 100,
            shown.plagueMonths,
          );
          context.imageSmoothingEnabled = true;
          if (backdrop) {
            context.drawImage(backdrop, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
          } else {
            context.clearRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
          }
          context.drawImage(
            sheet,
            0,
            bounce * PORTRAIT_SIZE,
            PORTRAIT_SIZE,
            PORTRAIT_SIZE,
            0,
            0,
            PORTRAIT_SIZE,
            PORTRAIT_SIZE,
          );
          raf = requestAnimationFrame(render);
        };
        render();
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [look]);
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
