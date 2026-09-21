"use client";
import { useCallback, useEffect, useState } from "react";
import type { GameDate } from "@/lib/game-time";
import { GodWorld, type WorldSnapshot } from "@/lib/god/engine";
import type { PowerId } from "@/lib/god/types";
import type { MapData } from "@/lib/map";
import type { PreviewMossling } from "@/lib/map-preview";

export function useGodWorld(
  map: MapData | null,
  mosslings: PreviewMossling[],
  getDate: () => GameDate,
  getElapsed: () => number,
) {
  const [engine, setEngine] = useState<GodWorld | null>(null);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  useEffect(() => {
    if (!map) return;
    const world = new GodWorld(map, mosslings, getDate);
    setEngine(world);
    setSnapshot(world.snapshot());
    let frame = 0,
      last = performance.now(),
      dirty = false,
      sincePublish = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(0.25, (now - last) / 1000);
      last = now;
      dirty = world.advanceTo(getElapsed()) || dirty;
      sincePublish += elapsed;
      if (dirty && sincePublish >= 0.1) {
        setSnapshot(world.snapshot());
        sincePublish = 0;
        dirty = false;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [map, mosslings, getDate, getElapsed]);
  const cast = useCallback(
    (power: PowerId, x: number, y: number) => {
      if (!engine) return "The world is still growing.";
      engine.advanceTo(getElapsed());
      const result = engine.cast(power, x, y);
      setSnapshot(engine.snapshot());
      return result;
    },
    [engine, getElapsed],
  );
  return {
    engine,
    cast,
    map: snapshot?.map ?? map,
    mosslings: snapshot?.mosslings ?? mosslings,
    events: snapshot?.events ?? [],
    resources: snapshot?.resources ?? null,
  };
}
