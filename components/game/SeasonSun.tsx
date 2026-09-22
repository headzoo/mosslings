"use client";

import { useEffect, useRef } from "react";
import type { Season } from "@/lib/game-time";

const SIZE = 32;
const FRAMES = 16;
const CYCLE_SECONDS = 4;

type Rgb = readonly [number, number, number];

const SUNS: Record<
  Season,
  { body: Rgb; ray: Rgb; core: Rgb; cloudy: boolean }
> = {
  Summer: {
    body: [255, 214, 48],
    ray: [255, 243, 160],
    core: [255, 248, 210],
    cloudy: false,
  },
  Spring: {
    body: [255, 236, 140],
    ray: [255, 250, 214],
    core: [255, 255, 255],
    cloudy: false,
  },
  Autumn: {
    body: [245, 150, 48],
    ray: [255, 196, 110],
    core: [255, 220, 150],
    cloudy: true,
  },
  Winter: {
    body: [196, 214, 228],
    ray: [232, 240, 246],
    core: [255, 255, 255],
    cloudy: true,
  },
};

const CLOUD: Rgb = [236, 242, 246];
const CLOUD_SHADE: Rgb = [186, 198, 210];

function plot(
  image: ImageData,
  frame: number,
  x: number,
  y: number,
  color: Rgb,
) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= SIZE || py >= SIZE) return;
  const offset = ((frame * SIZE + py) * SIZE + px) * 4;
  image.data[offset] = color[0];
  image.data[offset + 1] = color[1];
  image.data[offset + 2] = color[2];
  image.data[offset + 3] = 255;
}

function disc(
  image: ImageData,
  frame: number,
  cx: number,
  cy: number,
  radius: number,
  color: Rgb,
) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= radius * radius) plot(image, frame, x, y, color);
    }
  }
}

const SPIKES = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
] as const;

function spike(
  image: ImageData,
  frame: number,
  dx: number,
  dy: number,
  pixels: number,
  color: Rgb,
) {
  const diagonal = dx !== 0 && dy !== 0;
  const start = diagonal ? 5 : 7;
  for (let step = start; step < start + pixels; step++) {
    plot(image, frame, 15 + dx * step, 15 + dy * step, color);
  }
}

function glint(image: ImageData, frame: number) {
  const angle = -Math.PI * 0.9 + (frame / (FRAMES - 1)) * Math.PI * 0.8;
  const x = 15.5 + Math.cos(angle) * 3.1;
  const y = 15.5 + Math.sin(angle) * 3.1;
  plot(image, frame, x, y, [255, 255, 255]);
  plot(image, frame, x + 1, y, [255, 255, 255]);
}

function clouds(image: ImageData, frame: number) {
  const shift = frame * 2;
  const puffs = [
    { x: 6, y: 13, r: 3.2, color: CLOUD_SHADE },
    { x: 11, y: 11, r: 3.6, color: CLOUD },
    { x: 16, y: 14, r: 3.1, color: CLOUD },
    { x: 12, y: 16, r: 2.4, color: CLOUD_SHADE },
  ];
  for (const puff of puffs) {
    const x = shift + puff.x;
    disc(image, frame, x, puff.y, puff.r, puff.color);
    disc(image, frame, x - SIZE, puff.y, puff.r, puff.color);
    disc(image, frame, x + SIZE, puff.y, puff.r, puff.color);
  }
}

function drawFrame(image: ImageData, season: Season, frame: number) {
  const look = SUNS[season];
  const pulse = Math.floor(frame / 2) % 2;
  for (let index = 0; index < SPIKES.length; index++) {
    const dir = SPIKES[index];
    if (!dir) continue;
    const long = (index + pulse) % 2 === 0;
    spike(image, frame, dir[0], dir[1], long ? 4 : 3, look.ray);
  }
  disc(image, frame, 15.5, 15.5, frame % 2 === 0 ? 6.6 : 6.2, look.body);
  disc(image, frame, 15.5, 15.5, 3.2, look.core);
  glint(image, frame);
  if (look.cloudy) clouds(image, frame);
}

function buildSheet(season: Season) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE * FRAMES;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  for (let frame = 0; frame < FRAMES; frame++) drawFrame(image, season, frame);
  sprite.putImageData(image, 0, 0);
  return canvas;
}

function sunFrame(elapsed: number) {
  const wrapped = ((elapsed % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const span = CYCLE_SECONDS / FRAMES;
  return Math.min(FRAMES - 1, Math.floor(wrapped / span));
}

export function SeasonSun({
  season = "Summer",
  elapsed = () => 0,
}: {
  season?: Season;
  elapsed?: () => number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const sheet = buildSheet(season);
    if (!sheet) return;
    let frame = 0;
    const render = () => {
      const shown = sunFrame(elapsedRef.current());
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(sheet, 0, shown * SIZE, SIZE, SIZE, 0, 0, SIZE, SIZE);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [season]);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      className="year-sun"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
