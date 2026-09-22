"use client";

import { useEffect, useRef, useState } from "react";
import { FRAME_COUNT } from "@/lib/mossling-detail";

const ASCENT_SECONDS = 1;

function playingFrame(into: number) {
  const span = ASCENT_SECONDS / FRAME_COUNT;
  return Math.min(FRAME_COUNT - 1, Math.floor(into / span));
}

export function useDiedStatQueue(
  deaths: number | null,
  elapsed: () => number = () => 0,
) {
  const [displayedCount, setDisplayedCount] = useState<number | null>(deaths);
  const [spriteFrame, setSpriteFrame] = useState(0);
  const elapsedRef = useRef(elapsed);
  const deathsRef = useRef(deaths);
  elapsedRef.current = elapsed;
  deathsRef.current = deaths;

  useEffect(() => {
    const seen = { current: null as number | null };
    const queue = { current: 0 };
    const playStart = { current: null as number | null };
    let lastDisplayed: number | null = deathsRef.current;
    let lastFrame = 0;
    let frame = 0;

    const render = () => {
      const deathsNow = deathsRef.current;
      if (deathsNow !== null) {
        if (seen.current === null) seen.current = deathsNow;
        else if (deathsNow > seen.current) {
          queue.current += deathsNow - seen.current;
          seen.current = deathsNow;
        } else if (deathsNow < seen.current) {
          seen.current = deathsNow;
          queue.current = 0;
          playStart.current = null;
        }
      }
      const elapsedNow = elapsedRef.current();
      if (queue.current > 0 && playStart.current === null) {
        playStart.current = elapsedNow;
      }
      let into =
        playStart.current === null ? 0 : elapsedNow - playStart.current;
      while (queue.current > 0 && into >= ASCENT_SECONDS) {
        queue.current -= 1;
        if (playStart.current !== null) playStart.current += ASCENT_SECONDS;
        into -= ASCENT_SECONDS;
      }
      if (queue.current === 0) playStart.current = null;

      const animating = queue.current > 0 && playStart.current !== null;
      const nextDisplayed =
        seen.current === null
          ? null
          : seen.current - queue.current + (animating ? 1 : 0);
      const nextFrame = queue.current > 0 ? playingFrame(into) : 0;

      if (nextDisplayed !== lastDisplayed) {
        lastDisplayed = nextDisplayed;
        setDisplayedCount(nextDisplayed);
      }
      if (nextFrame !== lastFrame) {
        lastFrame = nextFrame;
        setSpriteFrame(nextFrame);
      }

      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, []);

  return { displayedCount, spriteFrame };
}
