"use client";

import {
  type CSSProperties,
  type RefObject,
  useLayoutEffect,
  useState,
} from "react";

export type IntroPhase = "mosslings" | "species" | "powers" | "world";

export type IntroSpotlight = {
  x: number;
  y: number;
  r: number;
};

const HIGHLIGHT_PAD = 8;

function useHighlightRect(
  target: RefObject<HTMLElement | null>,
  active: boolean,
) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!active || !target.current) {
      setRect(null);
      return;
    }
    const node = target.current;
    const measure = () => setRect(node.getBoundingClientRect());
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active, target]);
  return rect;
}

function DimPanels({
  hole,
}: {
  hole: NonNullable<ReturnType<typeof highlightHole>>;
}) {
  return (
    <div className="mossling-intro-dim-panels" aria-hidden="true">
      <div
        className="mossling-intro-dim-panel"
        style={{ top: 0, left: 0, right: 0, height: hole.top }}
      />
      <div
        className="mossling-intro-dim-panel"
        style={{
          top: hole.top,
          left: 0,
          width: hole.left,
          height: hole.bottom - hole.top,
        }}
      />
      <div
        className="mossling-intro-dim-panel"
        style={{
          top: hole.top,
          left: hole.right,
          right: 0,
          height: hole.bottom - hole.top,
        }}
      />
      <div
        className="mossling-intro-dim-panel"
        style={{ top: hole.bottom, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}

function highlightHole(rect: DOMRect) {
  return {
    top: rect.top - HIGHLIGHT_PAD,
    left: rect.left - HIGHLIGHT_PAD,
    right: rect.right + HIGHLIGHT_PAD,
    bottom: rect.bottom + HIGHLIGHT_PAD,
  };
}

type MosslingIntroProps = {
  phase: IntroPhase;
  onContinue: () => void;
  spotlight?: IntroSpotlight | null;
  highlightRef?: RefObject<HTMLElement | null>;
};

export function MosslingIntro({
  phase,
  onContinue,
  spotlight = null,
  highlightRef,
}: MosslingIntroProps) {
  const highlightActive = phase === "species" || phase === "powers";
  const highlightRect = useHighlightRect(
    highlightRef ?? { current: null },
    highlightActive,
  );
  const hole = highlightRect ? highlightHole(highlightRect) : null;

  const style =
    phase === "mosslings" && spotlight
      ? ({
          "--lens-x": `${spotlight.x}px`,
          "--lens-y": `${spotlight.y}px`,
          "--lens-r": `${spotlight.r}px`,
        } as CSSProperties)
      : phase === "species" && highlightRect
        ? ({
            "--callout-top": `${highlightRect.top + highlightRect.height / 2}px`,
            "--callout-right": `${window.innerWidth - highlightRect.left + HIGHLIGHT_PAD + 16}px`,
            "--callout-max-width": `${Math.max(200, highlightRect.left - HIGHLIGHT_PAD - 32)}px`,
          } as CSSProperties)
        : phase === "powers" && highlightRect
          ? ({
              "--callout-top": `${highlightRect.top + highlightRect.height / 2}px`,
              "--callout-left": `${highlightRect.right + HIGHLIGHT_PAD + 16}px`,
              "--callout-max-width": `${Math.max(200, window.innerWidth - highlightRect.right - HIGHLIGHT_PAD - 32)}px`,
            } as CSSProperties)
          : undefined;

  return (
    <section
      className={`mossling-intro mossling-intro--${phase}`}
      style={style}
      aria-labelledby={`mossling-intro-${phase}-title`}
    >
      {phase === "mosslings" && (
        <div className="mossling-intro-dim" aria-hidden="true" />
      )}
      {highlightActive && hole && <DimPanels hole={hole} />}
      <div className={`mossling-intro-copy mossling-intro-copy--${phase}`}>
        {phase === "mosslings" && (
          <>
            <h2 id="mossling-intro-mosslings-title">These are Mosslings.</h2>
            <p>
              These 8x8 colorful little circles are your Mosslings. They come in
              all different colors based on their genetics — patterns, shades,
              and traits passed down from their parents.
              <br />
              <br />
              Each one is a unique species. Watch them wander, find mates, and
              adapt to the world you shape. Take care of them.
            </p>
          </>
        )}
        {phase === "species" && (
          <>
            <h2 id="mossling-intro-species-title">This is the species list.</h2>
            <p>
              Mosslings that look alike or share close ancestry belong to one
              species. Each species gets a unique name and shows how many
              Mosslings belong to it. Click a species to find them on the map.
            </p>
          </>
        )}
        {phase === "powers" && (
          <>
            <h2 id="mossling-intro-powers-title">These are your god powers.</h2>
            <p>
              Choose a power from the rail, then click tiles on the map to use
              it. Bring rain, sunlight, and carrots to help your Mosslings — or
              unleash fire, disease, and disasters to see how they cope. Press
              Esc to cancel a selected power.
            </p>
          </>
        )}
        {phase === "world" && (
          <>
            <h2 id="mossling-intro-world-title">
              And this is the Mossling world.
            </h2>
            <p>
              It has rivers, trees, grass, and natural disasters. Mosslings roam
              across it, foraging for food, raising families, and weathering
              whatever you send their way. Bring rain, plant carrots, or call
              down fire and see how the land — and its little inhabitants —
              respond.
            </p>
          </>
        )}
        <button type="button" onClick={onContinue}>
          Continue
        </button>
      </div>
    </section>
  );
}
