"use client";

import { useEffect, useRef } from "react";

const SIZE = 32;
const FRAMES = 60;
const CYCLE_SECONDS = 5;
const CENTER = 15.5;

type Rgb = readonly [number, number, number];

const RIM: Rgb = [246, 241, 231];
const MINUTE: Rgb = [196, 188, 168];
const SECOND: Rgb = [255, 248, 214];
const PIVOT: Rgb = [255, 255, 255];

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

function ring(image: ImageData, frame: number, radius: number, color: Rgb) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - CENTER;
      const dy = y + 0.5 - CENTER;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(dist - radius) <= 0.62) plot(image, frame, x, y, color);
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
  thick = false,
) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - x);
  const dy = Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx - dy;
  while (true) {
    plot(image, frame, x, y, color);
    if (thick) {
      plot(image, frame, x + 1, y, color);
      plot(image, frame, x, y + 1, color);
    }
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function ticks(image: ImageData, frame: number) {
  const marks = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;
  for (const [dx, dy] of marks) {
    const start = 10;
    for (let step = start; step < start + 2; step++) {
      plot(image, frame, 15 + dx * step, 15 + dy * step, RIM);
    }
  }
}

function hand(
  image: ImageData,
  frame: number,
  position: number,
  length: number,
  color: Rgb,
  thick: boolean,
) {
  const angle = -Math.PI / 2 + (position / 12) * Math.PI * 2;
  line(
    image,
    frame,
    CENTER,
    CENTER,
    CENTER + Math.cos(angle) * length,
    CENTER + Math.sin(angle) * length,
    color,
    thick,
  );
}

function drawFrame(image: ImageData, frame: number) {
  ring(image, frame, 13, RIM);
  ticks(image, frame);
  hand(image, frame, Math.floor(frame / 5) % 12, 8, MINUTE, true);
  hand(image, frame, frame % 12, 11, SECOND, false);
  plot(image, frame, 15, 15, PIVOT);
  plot(image, frame, 16, 15, PIVOT);
  plot(image, frame, 15, 16, PIVOT);
  plot(image, frame, 16, 16, PIVOT);
}

function buildSheet() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE * FRAMES;
  const sprite = canvas.getContext("2d");
  if (!sprite) return null;
  const image = sprite.createImageData(canvas.width, canvas.height);
  for (let frame = 0; frame < FRAMES; frame++) drawFrame(image, frame);
  sprite.putImageData(image, 0, 0);
  return canvas;
}

function clockFrame(elapsed: number) {
  const wrapped = ((elapsed % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  const span = CYCLE_SECONDS / FRAMES;
  return Math.min(FRAMES - 1, Math.floor(wrapped / span));
}

export function YearClock({ elapsed = () => 0 }: { elapsed?: () => number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const sheet = buildSheet();
    if (!sheet) return;
    let frame = 0;
    const render = () => {
      const shown = clockFrame(elapsedRef.current());
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(sheet, 0, shown * SIZE, SIZE, SIZE, 0, 0, SIZE, SIZE);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      className="year-clock"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
