"use client";

import { useEffect, useRef } from "react";
import {
  FRAME_COUNT,
  SPRITE_SIZE,
  skinnedSpritePixel,
} from "@/lib/mossling-detail";
import type { PreviewMossling } from "@/lib/map-preview";

const STAT_MOSSLING: PreviewMossling = {
  id: 0,
  cellIndex: 0,
  health: 100,
  colors: ["#6b9e2f", "#5d8522", "#c5e04a"],
  pattern: 4,
};

/** One full squash-and-stretch pass, slower than map sprites. */
const STAT_BOUNCE_SECONDS = 1;
/** Rest on the idle frame between bounce passes. */
const STAT_PAUSE_SECONDS = 2;
const STAT_CYCLE_SECONDS = STAT_BOUNCE_SECONDS + STAT_PAUSE_SECONDS;

function statBounceFrame(elapsed: number): number {
  const inCycle =
    ((elapsed % STAT_CYCLE_SECONDS) + STAT_CYCLE_SECONDS) % STAT_CYCLE_SECONDS;
  if (inCycle >= STAT_BOUNCE_SECONDS) return 0;
  const span = STAT_BOUNCE_SECONDS / FRAME_COUNT;
  return Math.min(FRAME_COUNT - 1, Math.floor(inCycle / span));
}

function buildSpriteSheet(mossling: PreviewMossling) {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = skinnedSpritePixel(frame, x, y, mossling);
        if (!pixel) continue;
        const offset = ((frame * SPRITE_SIZE + y) * SPRITE_SIZE + x) * 4;
        image.data[offset] = pixel[0];
        image.data[offset + 1] = pixel[1];
        image.data[offset + 2] = pixel[2];
        image.data[offset + 3] = pixel[3];
      }
    }
  }
  sprite.putImageData(image, 0, 0);
  return canvas;
}

export function MosslingStatIcon({
  elapsed = () => 0,
}: {
  elapsed?: () => number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const sheet = buildSpriteSheet(STAT_MOSSLING);
    if (!sheet) return;
    let frame = 0;
    const render = () => {
      const bounce = statBounceFrame(elapsedRef.current());
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(
        sheet,
        0,
        bounce * SPRITE_SIZE,
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
      aria-hidden="true"
    />
  );
}
