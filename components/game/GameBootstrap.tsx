"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { plantStarterFields } from "@/lib/crops";
import { plantStarterForests } from "@/lib/god/ecology";
import {
  createIntroMosslings,
  ensureIntroZone,
  introZoneIndices,
} from "@/lib/intro-mosslings";
import { generateMap, type MapData, pruneBeaches, randomSeed } from "@/lib/map";
import {
  createPreviewMosslings,
  getGridDimensions,
  type PreviewMossling,
} from "@/lib/map-preview";
import { GameScreen } from "./GameScreen";
import type { IntroPhase } from "./MosslingIntro";
import {
  isIntroDismissed,
  rememberIntroDismissal,
  WELCOME_PREFERENCE,
  WelcomeSplash,
} from "./WelcomeSplash";

const EMPTY_MOSSLINGS: PreviewMossling[] = [];

export function GameBootstrap() {
  const [showWelcome, setShowWelcome] = useState<boolean | null>(null);
  const [introPhase, setIntroPhase] = useState<IntroPhase | null>(null);
  useLayoutEffect(() => {
    try {
      const hideWelcome = localStorage.getItem(WELCOME_PREFERENCE) === "true";
      setShowWelcome(!hideWelcome);
      if (hideWelcome && !isIntroDismissed()) setIntroPhase("mosslings");
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
      ensureIntroZone(map);
      const intro = createIntroMosslings(map);
      const occupied = introZoneIndices(map);
      const rest = createPreviewMosslings(map, { startId: 4, occupied });
      const mosslings = [...intro, ...rest];
      for (const mossling of rest) occupied.add(mossling.cellIndex);
      plantStarterForests(map, occupied);
      plantStarterFields(map, mosslings.length, occupied);
      ensureIntroZone(map);
      pruneBeaches(map);
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
        introPhase={world ? introPhase : null}
        onIntroContinue={() =>
          setIntroPhase((phase) => {
            if (phase === "mosslings") return "species";
            if (phase === "species") return "map";
            if (phase === "map") return "powers";
            if (phase === "powers") return "world";
            if (phase === "world") {
              try {
                rememberIntroDismissal();
              } catch {
                // Intro finished; preference is best-effort.
              }
              return null;
            }
            return null;
          })
        }
        onRestoreWelcome={() => {
          setShowWelcome(true);
          setIntroPhase(null);
        }}
      />
      {showWelcome && (
        <WelcomeSplash
          ready={!!world}
          onDismiss={() => {
            setShowWelcome(false);
            if (!isIntroDismissed()) setIntroPhase("mosslings");
          }}
        />
      )}
    </>
  );
}
