"use client";

import { useEffect, useRef, useState } from "react";
import { FRAME_COUNT, SPRITE_SIZE } from "@/lib/mossling-detail";
import { HudIcon } from "./HudIcon";

const CARROT_SRC = "/mosslings/icons/carrot.png";
/** One pass of four bites, from the leaves down to the tip. Loops while the supply is falling. */
const BITE_SECONDS = 0.7;
/**
 * Food is published in steps, so a decline can sit still between ticks.
 * Keep chewing until the count rises or has held steady this long.
 */
const DROP_HOLD_SECONDS = 1.2;

/** A scoop taken from the top. Everything above the shoulder is gone. */
type Bite = { shoulder: number; reach: number; rx: number; cx: number };

const BITES: readonly Bite[] = [
  { shoulder: 6.5, reach: 3.6, rx: 11, cx: 15.5 },
  { shoulder: 13.2, reach: 3.6, rx: 8.6, cx: 16 },
  { shoulder: 18.6, reach: 4.1, rx: 6.8, cx: 16 },
  { shoulder: 24.6, reach: 2.2, rx: 5.5, cx: 16 },
];

function useCarrotFalling(value: number | null, elapsed: () => number) {
  const [falling, setFalling] = useState(false);
  const elapsedRef = useRef(elapsed);
  const valueRef = useRef(value);
  elapsedRef.current = elapsed;
  valueRef.current = value;

  useEffect(() => {
    const previous = { current: null as number | null };
    const lastDrop = { current: null as number | null };
    let frame = 0;
    const render = () => {
      const current = valueRef.current;
      const now = elapsedRef.current();
      if (current !== null) {
        const before = previous.current;
        if (before !== null) {
          if (current < before) lastDrop.current = now;
          else if (current > before) lastDrop.current = null;
        }
        previous.current = current;
      } else {
        lastDrop.current = null;
      }
      const next =
        lastDrop.current !== null && now - lastDrop.current < DROP_HOLD_SECONDS;
      setFalling((was) => (was === next ? was : next));
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, []);

  return falling;
}

function biteCovers(bite: Bite, x: number, y: number) {
  const py = y + 0.5;
  if (py < bite.shoulder) return true;
  const dx = (x + 0.5 - bite.cx) / bite.rx;
  const dy = (py - bite.shoulder) / bite.reach;
  return dx * dx + dy * dy <= 1;
}

function punchBite(context: CanvasRenderingContext2D, bite: Bite) {
  const image = context.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const pixels = image.data;
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      if (!biteCovers(bite, x, y)) continue;
      pixels[(y * SPRITE_SIZE + x) * 4 + 3] = 0;
    }
  }
  context.putImageData(image, 0, 0);
}

function buildBiteSheet(image: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = SPRITE_SIZE;
  frameCanvas.height = SPRITE_SIZE;
  const frameContext = frameCanvas.getContext("2d");
  if (!frameContext) return null;
  sprite.imageSmoothingEnabled = false;
  frameContext.imageSmoothingEnabled = false;
  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    frameContext.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    frameContext.drawImage(image, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
    const bite = BITES[frame];
    if (bite) punchBite(frameContext, bite);
    sprite.drawImage(frameCanvas, 0, frame * SPRITE_SIZE);
  }
  return canvas;
}

function biteFrame(elapsed: number) {
  const wrapped = ((elapsed % BITE_SECONDS) + BITE_SECONDS) % BITE_SECONDS;
  const span = BITE_SECONDS / FRAME_COUNT;
  return Math.min(FRAME_COUNT - 1, Math.floor(wrapped / span));
}

function CarrotBiteSprite({ elapsed }: { elapsed: () => number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = new Image();
    let frame = 0;
    let stopped = false;
    image.onload = () => {
      const sheet = buildBiteSheet(image);
      if (!sheet || stopped) return;
      const draw = () => {
        if (stopped) return;
        const shown = biteFrame(elapsedRef.current());
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
        frame = requestAnimationFrame(draw);
      };
      draw();
    };
    image.src = CARROT_SRC;
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
    };
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

export function CarrotStatIcon({
  value = null,
  elapsed = () => 0,
}: {
  value?: number | null;
  elapsed?: () => number;
}) {
  const falling = useCarrotFalling(value, elapsed);
  if (!falling) return <HudIcon src={CARROT_SRC} />;
  return <CarrotBiteSprite elapsed={elapsed} />;
}
