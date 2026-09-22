"use client";
import { useEffect, useRef } from "react";
import type { GodWorld } from "@/lib/god/engine";
import type { Camera } from "@/lib/map-camera";

export function GodEffects({
  engine,
  cameraRef,
  tileSize,
  width,
  height,
}: {
  engine: GodWorld;
  cameraRef: { current: Camera | null };
  tileSize: number;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    let clear = true;
    const render = () => {
      const camera = cameraRef.current;
      if (!camera || engine.effects.length === 0) {
        if (!clear) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          clear = true;
        }
        frame = requestAnimationFrame(render);
        return;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);
      clear = false;
      engine.draw({
        width: engine.map.width,
        height: engine.map.height,
        cell(x, y, color, size = 1, alpha = 1) {
          if (x < 0 || y < 0 || x >= engine.map.width || y >= engine.map.height)
            return;
          const px = Math.round(camera.left + x * tileSize),
            py = Math.round(camera.top + y * tileSize);
          if (
            px > width ||
            py > height ||
            px + size * tileSize < 0 ||
            py + size * tileSize < 0
          )
            return;
          context.globalAlpha = Math.max(0, Math.min(1, alpha));
          context.fillStyle = color;
          context.fillRect(
            px,
            py,
            Math.max(1, Math.round(size * tileSize)),
            Math.max(1, Math.round(size * tileSize)),
          );
        },
      });
      context.globalAlpha = 1;
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, [engine, cameraRef, tileSize, width, height]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      className="god-effects"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}
