"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  gameDateAt,
  nextFastForwardStep,
  nextSpringAt,
  timeRateAt,
} from "@/lib/game-time";

export function useGameTime(suspended = false) {
  const elapsedRef = useRef(0);
  const [date, setDate] = useState(() => gameDateAt(0));
  const [isPlaying, setIsPlaying] = useState(true);
  const [speedStep, setSpeedStep] = useState(0);
  const rate = timeRateAt(speedStep);

  useEffect(() => {
    if (!isPlaying || suspended) return;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsedRef.current += ((now - last) / 1000) * rate;
      last = now;
      const nextDate = gameDateAt(elapsedRef.current);
      setDate((current) =>
        current.year === nextDate.year && current.season === nextDate.season
          ? current
          : nextDate,
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPlaying, rate, suspended]);

  const togglePlaying = useCallback(() => {
    if (!isPlaying) setSpeedStep(0);
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skipToNextSpring = useCallback(() => {
    elapsedRef.current = nextSpringAt(elapsedRef.current);
    setDate(gameDateAt(elapsedRef.current));
    setSpeedStep(0);
  }, []);

  const fastForward = useCallback(() => {
    setSpeedStep((step) => nextFastForwardStep(step));
  }, []);

  const getDate = useCallback(() => gameDateAt(elapsedRef.current), []);
  const getElapsed = useCallback(() => elapsedRef.current, []);

  return {
    ...date,
    isPlaying,
    rate,
    togglePlaying,
    skipToNextSpring,
    fastForward,
    getDate,
    getElapsed,
  };
}
