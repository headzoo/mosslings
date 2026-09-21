"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type Chiptune, createChiptune } from "@/lib/chiptune";

export const MUSIC_MUTE_KEY = "mosslings:music-muted";

function readMuted() {
  try {
    return localStorage.getItem(MUSIC_MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUSIC_MUTE_KEY, muted ? "true" : "false");
  } catch {
    // Private mode or a full quota should not block the in-session mute.
  }
}

export function useMusic() {
  const [muted, setMuted] = useState(false);
  const player = useRef<Chiptune | null>(null);

  useLayoutEffect(() => {
    setMuted(readMuted());
  }, []);

  useEffect(() => {
    const chiptune = createChiptune();
    player.current = chiptune;
    chiptune.setMuted(readMuted());
    return () => {
      chiptune.dispose();
      player.current = null;
    };
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      writeMuted(next);
      player.current?.setMuted(next);
      return next;
    });
  }, []);

  return { muted, toggleMuted };
}
