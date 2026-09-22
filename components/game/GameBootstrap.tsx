"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { plantStarterFields } from "@/lib/crops";
import { plantStarterForests } from "@/lib/god/ecology";
import { generateMap, type MapData, randomSeed } from "@/lib/map";
import {
  createPreviewMosslings,
  getGridDimensions,
  type PreviewMossling,
} from "@/lib/map-preview";
import { GameScreen } from "./GameScreen";
import { WELCOME_PREFERENCE, WelcomeSplash } from "./WelcomeSplash";

const EMPTY_MOSSLINGS: PreviewMossling[] = [];

export function GameBootstrap() {
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    try {
      setShowWelcome(localStorage.getItem(WELCOME_PREFERENCE) !== "true");
    } catch {
      setShowWelcome(true);
    }
  }, []);
  const boardRef = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<{
    map: MapData;
    mosslings: PreviewMossling[];
  } | null>(null);
  const seedRef = useRef<number | null>(null);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, []);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const seed = seedRef.current ?? randomSeed();
    seedRef.current = seed;
    let generated = false;
    // Measure the actual board after the HUD and rails take their space.
    // Generate once. Resizing moves the camera, never resets played terrain.
    const measure = () => {
      if (generated || board.clientWidth < 8 || board.clientHeight < 8) return;
      const { width, height } = getGridDimensions(
        board.clientWidth,
        board.clientHeight,
      );
      generated = true;
      const map = generateMap(width, height, {
        seed,
        waterLevel: 0.34,
        dirtMoistureThreshold: 0.43,
        rockThreshold: 0.66,
        rivers: { count: 1, minRadius: 1, maxRadius: 2 },
      });
      const mosslings = createPreviewMosslings(map);
      const occupied = new Set(mosslings.map((mossling) => mossling.cellIndex));
      plantStarterForests(map, occupied);
      plantStarterFields(map, mosslings.length, occupied);
      setWorld({ map, mosslings });
    };
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);
  return (
    <>
      <GameScreen
        map={world?.map ?? null}
        mosslings={world?.mosslings ?? EMPTY_MOSSLINGS}
        boardRef={boardRef}
        suspended={showWelcome !== false || !world}
        onRestoreWelcome={() => setShowWelcome(true)}
      />
      {showWelcome && (
        <WelcomeSplash
          ready={!!world}
          onDismiss={() => setShowWelcome(false)}
        />
      )}
    </>
  );
}
