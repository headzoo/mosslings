"use client";

import { useEffect, useRef } from "react";
import type { PowerId } from "@/lib/god/types";
import { FRAME_COUNT, SPRITE_SIZE } from "@/lib/mossling-detail";
import { HudIcon } from "./HudIcon";

const CYCLE_SECONDS = 0.8;

export const DISASTER_POWERS = [
  "fire",
  "tornado",
  "nuke",
  "lightning",
  "meteor",
] as const;
export type DisasterId = (typeof DISASTER_POWERS)[number];

type Rgb = readonly [number, number, number];

export function isDisasterPower(power: PowerId): power is DisasterId {
  return DISASTER_POWERS.some((kind) => kind === power);
}

function plot(
  image: ImageData,
  frame: number,
  x: number,
  y: number,
  color: Rgb,
  alpha = 255,
) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SPRITE_SIZE || py >= SPRITE_SIZE || alpha <= 0)
    return;
  const offset = ((frame * SPRITE_SIZE + py) * SPRITE_SIZE + px) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = alpha;
}

function ellipse(
  image: ImageData,
  frame: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Rgb,
) {
  if (rx <= 0 || ry <= 0) return;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) plot(image, frame, x, y, color);
    }
  }
}

function line(
  image: ImageData,
  frame: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgb,
) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    plot(image, frame, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color);
  }
}

function drawFire(image: ImageData, frame: number) {
  const heights = [12, 16, 9, 14] as const;
  const leans = [0, -1.6, 1.2, -0.4] as const;
  const height = heights[frame] ?? 12;
  const lean = leans[frame] ?? 0;
  const base = 27;
  ellipse(
    image,
    frame,
    16 + lean,
    base - height * 0.42,
    7,
    height * 0.55,
    [255, 92, 24],
  );
  ellipse(
    image,
    frame,
    16 + lean * 0.45,
    base - height * 0.28,
    4.2,
    height * 0.38,
    [255, 168, 32],
  );
  ellipse(image, frame, 16, base - 2.5, 2.3, 3.2, [255, 236, 130]);
}

function drawTornado(image: ImageData, frame: number) {
  const sway = [0, -2.4, 0.4, 2.2] as const;
  const lean = sway[frame] ?? 0;
  const light: Rgb = [236, 240, 244];
  const shade: Rgb = [150, 162, 176];
  for (let band = 0; band < 6; band++) {
    const t = band / 5;
    const y = 5 + band * 4.2;
    const rx = 8.2 - band * 1.15;
    const x = 16 + lean * (1 - t * 0.35);
    ellipse(image, frame, x, y, rx, 2.15, band % 2 === 0 ? light : shade);
  }
}

function drawNuke(image: ImageData, frame: number) {
  const stem = [6, 10, 13, 14] as const;
  const cap = [0, 2.2, 5.5, 8] as const;
  const height = stem[frame] ?? 6;
  const width = cap[frame] ?? 0;
  const base = 28;
  const smoke: Rgb = [186, 190, 196];
  const shade: Rgb = [120, 126, 134];
  const hot: Rgb = [255, 112, 36];
  ellipse(image, frame, 16, base - 1, 3.2 + frame * 0.3, 1.6, hot);
  for (let y = 0; y < height; y++) {
    const t = y / height;
    const rx = 1.15 + (1 - t) * 0.7;
    ellipse(image, frame, 16, base - 3 - y, rx, 1.05, y % 2 ? shade : smoke);
  }
  if (width > 0) {
    const capY = base - 3 - height;
    ellipse(image, frame, 16, capY, width, width * 0.42, smoke);
    ellipse(image, frame, 16, capY + 0.6, width * 0.72, width * 0.22, shade);
  }
}

function drawLightning(image: ImageData, frame: number) {
  const bright = frame === 1 || frame === 2;
  const bolt: Rgb = bright ? [255, 244, 140] : [232, 196, 48];
  const core: Rgb = [255, 255, 255];
  const points = [
    [16, 2],
    [11, 10],
    [18, 15],
    [12, 23],
    [17, 30],
  ] as const;
  for (let index = 0; index < points.length - 1; index++) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) continue;
    line(image, frame, from[0], from[1], to[0], to[1], bolt);
    line(image, frame, from[0] + 1, from[1], to[0] + 1, to[1], bolt);
    if (bright) {
      line(image, frame, from[0], from[1], to[0], to[1], core);
    }
  }
  if (frame === 3) {
    line(image, frame, 18, 15, 24, 22, bolt);
  }
}

function drawMeteor(image: ImageData, frame: number) {
  const spots = [
    [9, 7],
    [14, 12],
    [18, 18],
    [23, 24],
  ] as const;
  const spot = spots[frame] ?? spots[0];
  const rock: Rgb = [122, 78, 48];
  const hot: Rgb = [255, 120, 32];
  const glow: Rgb = [255, 210, 80];
  for (let trail = frame; trail >= 0; trail--) {
    const from = spots[trail];
    if (!from) continue;
    plot(image, frame, from[0] - 3, from[1] - 3, hot);
    plot(image, frame, from[0] - 2, from[1] - 2, glow);
  }
  ellipse(image, frame, spot[0], spot[1], 4.2, 3.6, rock);
  ellipse(image, frame, spot[0] - 1, spot[1] - 0.8, 1.4, 1.1, glow);
  if (frame === 3) {
    ellipse(image, frame, spot[0], spot[1] + 3, 6, 2.2, hot);
  }
}

const DRAW: Record<DisasterId, (image: ImageData, frame: number) => void> = {
  fire: drawFire,
  tornado: drawTornado,
  nuke: drawNuke,
  lightning: drawLightning,
  meteor: drawMeteor,
};

function buildDisasterSheet(kind: DisasterId) {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE * FRAME_COUNT;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  const draw = DRAW[kind];
  for (let frame = 0; frame < FRAME_COUNT; frame++) draw(image, frame);
  sprite.putImageData(image, 0, 0);
  return canvas;
}

function cycleFrame(elapsed: number) {
  const wrapped = ((elapsed % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const span = CYCLE_SECONDS / FRAME_COUNT;
  return Math.min(FRAME_COUNT - 1, Math.floor(wrapped / span));
}

function DisasterSprite({
  kind,
  elapsed,
}: {
  kind: DisasterId;
  elapsed: () => number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const sheet = buildDisasterSheet(kind);
    if (!sheet) return;
    let frame = 0;
    const render = () => {
      const shown = cycleFrame(elapsedRef.current());
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
  }, [kind]);

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

export function DestroyedStatIcon({
  activeDisaster = null,
  elapsed = () => 0,
}: {
  activeDisaster?: DisasterId | null;
  elapsed?: () => number;
}) {
  if (!activeDisaster) {
    return <HudIcon src="/mosslings/icons/destroyed.png" />;
  }
  return <DisasterSprite kind={activeDisaster} elapsed={elapsed} />;
}
