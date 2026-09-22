"use client";

import {
  type CSSProperties,
  type RefObject,
  useLayoutEffect,
  useState,
} from "react";

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

function highlightHole(rect: DOMRect) {
  return {
    top: rect.top - HIGHLIGHT_PAD,
    left: rect.left - HIGHLIGHT_PAD,
    right: rect.right + HIGHLIGHT_PAD,
    bottom: rect.bottom + HIGHLIGHT_PAD,
  };
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

type MoveIntroProps = {
  anchorRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
};

export function MoveIntro({ anchorRef, onDismiss }: MoveIntroProps) {
  const highlightRect = useHighlightRect(anchorRef, true);
  const hole = highlightRect ? highlightHole(highlightRect) : null;

  const style = highlightRect
    ? ({
        "--callout-bottom": `${window.innerHeight - highlightRect.top + HIGHLIGHT_PAD + 12}px`,
        "--callout-right": `${window.innerWidth - highlightRect.right}px`,
        "--callout-max-width": `${Math.max(200, highlightRect.left - 32)}px`,
      } as CSSProperties)
    : undefined;

  return (
    <section
      className="move-intro"
      style={style}
      aria-labelledby="move-intro-title"
    >
      {hole && <DimPanels hole={hole} />}
      <div className="mossling-intro-copy mossling-intro-copy--move">
        <h2 id="move-intro-title">Map controls</h2>
        <p>
          The pointer is your default tool — click tiles to inspect the world.
          Use the magnifying glasses to zoom in or out on a spot: select one,
          then click the map. When you&apos;re zoomed in, the hand lets you drag
          the map around. Click the pointer, click the same tool again, click
          outside the map, or zoom all the way out to go back to inspecting.
        </p>
        <button type="button" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </section>
  );
}
