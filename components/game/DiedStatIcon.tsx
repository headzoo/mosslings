"use client";

import { useEffect, useRef } from "react";
import { buildDiedSpriteSheet } from "@/lib/died-sprite";
import { SPRITE_SIZE } from "@/lib/mossling-detail";

export function DiedStatIcon({ spriteFrame = 0 }: { spriteFrame?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(spriteFrame);
  frameRef.current = spriteFrame;

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const sheet = buildDiedSpriteSheet();
    if (!sheet) return;
    let frame = 0;
    const render = () => {
      const shown = frameRef.current;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(
        sheet,
        0,
        shown * SPRITE_SIZE,
        SPRITE_SIZE,
        SPRITE_SIZE,
        0,
        0,
        SPRITE_SIZE,
        SPRITE_SIZE,
      );
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={ref}
      width={SPRITE_SIZE}
      height={SPRITE_SIZE}
      className="mossling-stat-icon"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
