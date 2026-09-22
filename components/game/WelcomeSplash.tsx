"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";

export const WELCOME_PREFERENCE = "mosslings:hide-welcome";
export const INTRO_PREFERENCE = "mosslings:hide-intro";
export const CROPS_INTRO_PREFERENCE = "mosslings:hide-crops-intro";

function clearStoredPreference(key: string) {
  localStorage.removeItem(key);
  const store = (
    window as Window & {
      cookieStore?: { delete: (name: string) => Promise<void> };
    }
  ).cookieStore;
  if (store) void store.delete(key);
  // biome-ignore lint/suspicious/noDocumentCookie: expire the same preference if it was stored as a cookie
  document.cookie = `${key}=; Max-Age=0; path=/; SameSite=Lax`;
}

export function isIntroDismissed() {
  try {
    return localStorage.getItem(INTRO_PREFERENCE) === "true";
  } catch {
    return false;
  }
}

export function rememberIntroDismissal() {
  localStorage.setItem(INTRO_PREFERENCE, "true");
}

export function forgetIntroDismissal() {
  clearStoredPreference(INTRO_PREFERENCE);
}

export function isCropIntroDismissed() {
  try {
    return localStorage.getItem(CROPS_INTRO_PREFERENCE) === "true";
  } catch {
    return false;
  }
}

export function rememberCropIntroDismissal() {
  localStorage.setItem(CROPS_INTRO_PREFERENCE, "true");
}

export function forgetCropIntroDismissal() {
  clearStoredPreference(CROPS_INTRO_PREFERENCE);
}

export function forgetWelcomeDismissal() {
  clearStoredPreference(WELCOME_PREFERENCE);
  forgetIntroDismissal();
  forgetCropIntroDismissal();
}

export function WelcomeSplash({
  ready,
  onDismiss,
}: {
  ready: boolean;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [storageError, setStorageError] = useState(false);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const preventCancel = (event: Event) => event.preventDefault();
    const preventEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", preventEscape, true);
    dialog?.addEventListener("cancel", preventCancel);
    dialog?.showModal();
    return () => {
      dialog?.removeEventListener("cancel", preventCancel);
      window.removeEventListener("keydown", preventEscape, true);
      dialog?.close();
    };
  }, []);

  function dismiss() {
    if (dontShowAgain) {
      try {
        localStorage.setItem(WELCOME_PREFERENCE, "true");
      } catch {
        setStorageError(true);
        setDontShowAgain(false);
        return;
      }
    }
    dialogRef.current?.close();
    onDismiss();
  }

  return (
    <dialog
      ref={dialogRef}
      className="welcome-splash"
      closedby="none"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-intro"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="welcome-art">
        <Image
          className="welcome-scene"
          src="/mosslings/welcome-farm.webp"
          alt="Eight colorful Mosslings farm a sunny garden under open sky. Two nestle close and blush, while the others tend little carrot rows."
          width={864}
          height={1152}
          sizes="(max-width: 700px) 94vw, 480px"
          loading="eager"
        />
        <Image
          className="welcome-logo"
          src="/mosslings/logo-welcome.png"
          alt="Mosslings — Small genetic wonders"
          width={1250}
          height={394}
          sizes="(max-width: 700px) 90vw, 420px"
        />
        <p>Small creatures. Big wonder.</p>
      </div>
      <div className="welcome-copy">
        <p className="welcome-eyebrow">A little world awaits</p>
        <h1 id="welcome-title">Meet the Mosslings.</h1>
        <p id="welcome-intro">
          Tiny, fuzzy, and full of wonder. Mosslings are living tufts of moss
          from forests, ruins, and forgotten places. Each is a little different.
          Together, they make the world a little softer.
        </p>
        <h2>Your world. Their little lives.</h2>
        <p>
          This is a living sandbox. You shape the land; the Mosslings wander
          through it. Bring rain, plant carrots, or unleash a disaster and see
          how they respond. There’s no score to chase. Experiment, observe, and
          see what happens.
        </p>
        <ul className="welcome-hints">
          <li>
            <strong>Evolution:</strong> Tiny creatures. Endless possibilities.
            Real-world genetics inspire what makes each Mossling unique.
          </li>
          <li>
            <strong>Shape their home.</strong> Choose a power, then click a
            tile. Drag to explore and scroll to zoom.
          </li>
          <li>
            <strong>Take your time.</strong> Pause, speed up, or skip ahead with
            the time controls.
          </li>
        </ul>
        <div className="welcome-footer">
          <label className="welcome-preference">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(event) => {
                setDontShowAgain(event.target.checked);
                setStorageError(false);
              }}
            />
            Don&apos;t show this again
          </label>
          {storageError && (
            <p className="welcome-storage-error" role="alert">
              Your browser couldn’t save this preference. Click Close to
              continue for now.
            </p>
          )}
          <div className="welcome-actions">
            <output>
              {ready
                ? "Your little world is ready."
                : "Growing a little world…"}
            </output>
            <button type="button" onClick={dismiss}>
              Close <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
