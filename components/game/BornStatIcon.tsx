"use client";

import { useEffect, useRef } from "react";
import type { PreviewMossling } from "@/lib/map-preview";
import {
  FRAME_COUNT,
  SPRITE_SIZE,
  skinnedSpritePixel,
} from "@/lib/mossling-detail";

const BABY: PreviewMossling = {
  id: 1,
  cellIndex: 0,
  health: 100,
  colors: ["#d7f08a", "#b6e06a", "#f4ffc8"],
  pattern: 4,
};

/** Settled body, lifted by a pixel or two. Not the map squash. */
const LIFTS = [0, -1, -2, -1] as const;
const CYCLE_SECONDS = 1.2;

function buildBabySheet() {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const lift = LIFTS[frame] ?? 0;
    for (let y = 0; y < SPRITE_SIZE; y++) {
      for (let x = 0; x < SPRITE_SIZE; x++) {
        const pixel = skinnedSpritePixel(3, x, y, BABY);
        if (!pixel) continue;
        const dy = y + lift;
        if (dy < 0 || dy >= SPRITE_SIZE) continue;
        const offset = ((frame * SPRITE_SIZE + dy) * SPRITE_SIZE + x) * 4;
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

function bounceFrame(elapsed: number) {
  const wrapped = ((elapsed % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const span = CYCLE_SECONDS / FRAME_COUNT;
  return Math.min(FRAME_COUNT - 1, Math.floor(wrapped / span));
}

export function BornStatIcon({
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
    const sheet = buildBabySheet();
    if (!sheet) return;
    let frame = 0;
    const render = () => {
      const bounce = bounceFrame(elapsedRef.current());
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
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
