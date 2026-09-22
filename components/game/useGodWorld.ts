"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  useEffect(() => {
    if (!map) return;
    const world = new GodWorld(map, mosslings, getDate);
    revisionRef.current = world.revision;
    dirtyRef.current = false;
    setEngine(world);
    setSnapshot(world.snapshot());
    let frame = 0,
      last = performance.now(),
      sincePublish = 0;
    const animate = (now: number) => {
      const elapsed = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (world.advanceTo(getElapsed())) dirtyRef.current = true;
      revisionRef.current = world.revision;
      sincePublish += elapsed;
      if (dirtyRef.current && sincePublish >= 0.1) {
        setSnapshot(world.snapshot());
        sincePublish = 0;
        dirtyRef.current = false;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [map, mosslings, getDate, getElapsed]);
  const cast = useCallback(
    (power: PowerId, x: number, y: number, tune?: { quiet?: boolean }) => {
      if (!engine) return "The world is still growing.";
      const advanced = engine.advanceTo(getElapsed());
      const result = engine.cast(power, x, y, tune);
      if (advanced || result === null || !tune?.quiet) dirtyRef.current = true;
      revisionRef.current = engine.revision;
      return result;
    },
    [engine, getElapsed],
  );
  const moveMossling = useCallback(
    (id: number, x: number, y: number) => {
      if (!engine) return "The world is still growing.";
      const advanced = engine.advanceTo(getElapsed());
      const result = engine.moveMossling(id, x, y);
      if (advanced || result === null) dirtyRef.current = true;
      revisionRef.current = engine.revision;
      return result;
    },
    [engine, getElapsed],
  );
  const cloneMossling = useCallback(
    (id: number, x: number, y: number) => {
      if (!engine) return "The world is still growing.";
      const advanced = engine.advanceTo(getElapsed());
      const result = engine.cloneMossling(id, x, y);
      if (advanced || result === null) dirtyRef.current = true;
      revisionRef.current = engine.revision;
      return result;
    },
    [engine, getElapsed],
  );
  return {
    engine,
    cast,
    moveMossling,
    cloneMossling,
    revisionRef,
    map: engine?.map ?? map,
    mosslings: snapshot?.mosslings ?? mosslings,
    events: snapshot?.events ?? [],
    resources: snapshot?.resources ?? null,
    resourceHistory: snapshot?.resourceHistory ?? null,
  };
}
