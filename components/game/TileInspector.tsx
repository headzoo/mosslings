"use client";

import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { foliageAt, YEAR_SECONDS } from "@/lib/game-time";
import type { MapCell, MapData } from "@/lib/map";
import {
  iceCover,
  type PreviewMossling,
  snowBlanket,
  snowDepth,
} from "@/lib/map-preview";
import { previewTraits } from "@/lib/mossling-traits";
import { capturePortrait } from "@/lib/screenshot";

import { HudIcon } from "./HudIcon";
import { MosslingPortrait } from "./MosslingPortrait";
import { ScreenshotModal } from "./ScreenshotModal";
import { TilePortrait } from "./TilePortrait";

const terrainInfo = {
  grass: {
    title: "Grass & moss",
    description:
      "A soft carpet of green covers this patch of ground. Moist soil and fertile earth make it a welcoming place for hungry little Mosslings.",
  },
  dirt: {
    title: "Dirt",
    description:
      "A patch of exposed earth. Its moisture and fertility describe how much potential this little piece of ground has for new growth.",
  },
  rock: {
    title: "Rock",
    description:
      "Hard stone breaks through the soil here. A rugged patch with little fertile ground for vegetation.",
  },
  water: {
    title: "Water",
    description:
      "Water gathers in this low patch of ground. A cool, wet interruption in the landscape, separating the dry land around it. Late autumn skins it with ice, and the ice melts through spring.",
  },
};
const cropInfo = {
  title: "Carrots",
  description:
    "A carrot patch, full of a Mossling's favorite food. Small green tops poke up first, then orange roots swell beneath them. With rain and sun, the rows grow into a feast.",
};
const deadCropInfo = {
  title: "Dead carrots",
  description:
    "A blight took these carrots when they ripened. The rows are dead and feed no one. The sickness spreads into the carrot tiles beside them.",
};
export function TileInspector({
  seed,
  x,
  y,
  cell,
  map,
  mossling,
  speciesName,
  hostRef,
  onClose,
  onMove,
  onClone,
  elapsed,
}: {
  seed: number;
  x: number;
  y: number;
  cell: MapCell;
  map?: MapData | null;
  mossling?: PreviewMossling;
  speciesName?: string;
  hostRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onMove?: () => void;
  onClone?: () => void;
  elapsed?: () => number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originDx: number;
    originDy: number;
  } | null>(null);
  const crop = cell.growth !== undefined && !cell.tree;
  const deadCrop = crop && cell.blight === true && (cell.growth ?? 0) >= 1;
  const info = cell.tree
    ? {
        title: "Tree",
        description:
          "A small mossy tree takes root here, offering a patch of shade. A well-watered forest spreads into nearby grass and dirt. Fire and storms can damage it.",
      }
    : deadCrop
      ? deadCropInfo
      : crop
        ? cropInfo
        : terrainInfo[cell.terrain];
  const traits = mossling
    ? (mossling.traits ?? previewTraits(seed, mossling.id))
    : [];
  const title = mossling ? (speciesName ?? info.title) : info.title;
  const look = foliageAt(elapsed?.() ?? 0);
  const snow = map ? snowDepth(map, y * map.width + x, look.snow) : 0;
  const ice = map ? iceCover(y * map.width + x, look.ice) : look.ice;
  const buried = map ? snowBlanket(map, y * map.width + x, look) : false;
  const alive = mossling ? (mossling.health ?? 100) > 0 : false;
  const [portraitShot, setPortraitShot] = useState<Blob | null>(null);
  const [portraitProblem, setPortraitProblem] = useState<string | null>(null);
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const host = hostRef.current;
    if (!dialog || !host) return;
    const position = () => {
      const rect = host.getBoundingClientRect();
      const { dx, dy } = dragOffsetRef.current;
      dialog.style.left = `${rect.left + rect.width / 2 + dx}px`;
      dialog.style.top = `${rect.top + rect.height / 2 + dy}px`;
      dialog.style.width = `${Math.max(0, Math.min(460, rect.width - 16))}px`;
      dialog.style.maxHeight = `${Math.max(0, rect.height - 16)}px`;
    };
    position();
    dialog.showModal();
    closeRef.current?.focus();
    const observer = new ResizeObserver(position);
    observer.observe(host);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      dialog.close();
    };
  }, [hostRef]);
  const handleHeaderPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button")) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originDx: dragOffsetRef.current.dx,
      originDy: dragOffsetRef.current.dy,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleHeaderPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragOffsetRef.current = {
      dx: drag.originDx + event.clientX - drag.startX,
      dy: drag.originDy + event.clientY - drag.startY,
    };
    const dialog = dialogRef.current;
    const host = hostRef.current;
    if (!dialog || !host) return;
    const rect = host.getBoundingClientRect();
    const { dx, dy } = dragOffsetRef.current;
    dialog.style.left = `${rect.left + rect.width / 2 + dx}px`;
    dialog.style.top = `${rect.top + rect.height / 2 + dy}px`;
  };
  const handleHeaderPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      className="tile-inspector panel"
      aria-labelledby="tile-inspector-title"
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dialogRef.current?.close();
        }
      }}
    >
      <header
        className="inspector-header"
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerEnd}
        onPointerCancel={handleHeaderPointerEnd}
      >
        <div>
          <p className="inspector-eyebrow">
            {mossling ? "Meet a Mossling" : "A little patch of world"}
          </p>
          <h2 id="tile-inspector-title">{title}</h2>
          {mossling && (
            <p className="inspector-identity">Mossling #{mossling.id + 1}</p>
          )}
        </div>
        <button
          ref={closeRef}
          type="button"
          className="inspector-close"
          aria-label="Close tile information"
          onClick={onClose}
        >
          <span className="inspector-close-mark" aria-hidden="true" />
        </button>
      </header>
      <div className="inspector-content">
        {mossling ? (
          <div className="inspector-meta-row">
            <div className="inspector-meta-details">
              <p className="tile-coordinate">
                Tile {x}, {y} · {info.title}
              </p>
              {cell.tree && (
                <p className="tile-coordinate">
                  Tree health: {Math.ceil(cell.tree.health)}%
                </p>
              )}
              {cell.damage && (
                <p className="tile-coordinate">Ground: {cell.damage}</p>
              )}
              {crop && (
                <p className="tile-coordinate">
                  Carrots:{" "}
                  {(cell.growth ?? 0) >= 1
                    ? "ripe"
                    : (cell.growth ?? 0) <= 0
                      ? "just planted"
                      : `${Math.round((cell.growth ?? 0) * 100)}% grown`}
                </p>
              )}
              <p className="tile-coordinate">
                Health: {Math.ceil(mossling.health ?? 100)}%
                {(mossling.health ?? 100) <= 0
                  ? mossling.plagueMonths === undefined
                    ? " · Dead"
                    : " · Dead of the black death"
                  : mossling.plagueMonths === undefined
                    ? ""
                    : mossling.plagueMonths >= 3
                      ? " · Weakening with the black death"
                      : " · Infected with the black death"}
                {mossling.hungry && (mossling.health ?? 100) > 0 && " · Hungry"}
                {(mossling.panic ?? 0) > 0.1 &&
                  " · Panicked — trying to escape"}
                {mossling.ritual?.phase === "courtship" && " · Courting"}
                {mossling.soccer?.phase === "play" && " · Playing soccer"}
                {mossling.ritual?.phase === "family" &&
                  " · Staying with family"}
                {mossling.lastMatedAt != null &&
                  (elapsed?.() ?? 0) < mossling.lastMatedAt + YEAR_SECONDS &&
                  " · Resting from last mating"}
              </p>
              {mossling.parents && (
                <p className="tile-coordinate">
                  Child of Mossling #{mossling.parents[0] + 1} and #
                  {mossling.parents[1] + 1}
                </p>
              )}
            </div>
            <div className="inspector-actions">
              <button
                type="button"
                className="inspector-action-button inspector-shot"
                aria-label="Take a screenshot"
                title="Take a screenshot"
                onClick={() => {
                  const current = mossling;
                  void capturePortrait(current)
                    .then((blob) => {
                      setPortraitProblem(null);
                      setPortraitShot(blob);
                    })
                    .catch(() => {
                      setPortraitShot(null);
                      setPortraitProblem("The portrait couldn't be captured.");
                    });
                }}
              >
                <HudIcon src="/mosslings/icons/camera.png" />
              </button>
              {alive && onMove && (
                <button
                  type="button"
                  className="inspector-action-button"
                  onClick={onMove}
                >
                  Move
                </button>
              )}
              {alive && onClone && (
                <button
                  type="button"
                  className="inspector-action-button"
                  onClick={onClone}
                >
                  Clone
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="tile-coordinate">
              Tile {x}, {y} · {info.title}
            </p>
            {cell.tree && (
              <p className="tile-coordinate">
                Tree health: {Math.ceil(cell.tree.health)}%
              </p>
            )}
            {cell.damage && (
              <p className="tile-coordinate">Ground: {cell.damage}</p>
            )}
            {crop && (
              <p className="tile-coordinate">
                Carrots:{" "}
                {(cell.growth ?? 0) >= 1
                  ? "ripe"
                  : (cell.growth ?? 0) <= 0
                    ? "just planted"
                    : `${Math.round((cell.growth ?? 0) * 100)}% grown`}
              </p>
            )}
          </>
        )}
        {mossling ? (
          <>
            <div className="mossling-introduction">
              <MosslingPortrait
                mossling={mossling}
                elapsed={elapsed ?? (() => 0)}
              />
              <p>
                {traits[0].value >= 50
                  ? "A brave little wanderer"
                  : "A cautious little homebody"}
                ,{" "}
                {traits[2].value >= 50
                  ? "endlessly curious about the world"
                  : "happiest with familiar surroundings"}
                .{" "}
                {traits[3].value >= 50
                  ? "Loves a little company."
                  : "Enjoys a quiet patch of moss."}{" "}
                Peaceful, resilient, and not especially bright.
              </p>
            </div>
            <h3>Genetic qualities</h3>
            <p className="trait-note">
              Traits shape escape speed, reactions, herd behavior, and whether a
              Mossling flees or approaches the black death. They also decide how
              far a Mossling will travel to mate, whether a courtship takes, and
              what their children inherit. Metabolism and food drive decide how
              much each Mossling needs to eat.
            </p>
            <div className="trait-list">
              {traits.map((trait) => (
                <div className="trait" key={trait.label}>
                  <label htmlFor={`trait-${trait.label.replaceAll(" ", "-")}`}>
                    {trait.label}
                    <span>{trait.value}%</span>
                  </label>
                  <meter
                    id={`trait-${trait.label.replaceAll(" ", "-")}`}
                    min={0}
                    max={100}
                    value={trait.value}
                  >
                    {trait.value}%
                  </meter>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="terrain-introduction">
              <TilePortrait
                cell={cell}
                look={look}
                snow={snow}
                ice={ice}
                buried={buried}
              />
              <p>{info.description}</p>
            </div>
            <h3>Ground conditions</h3>
            <dl className="tile-conditions">
              {(
                [
                  ["Elevation", cell.elevation],
                  ["Moisture", cell.moisture],
                  ...(crop ? [["Light", cell.light ?? 0] as const] : []),
                  ["Rockiness", cell.rockiness],
                  ["Fertility", cell.fertility],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{Math.round(value * 100)}%</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
      {mossling && (portraitShot || portraitProblem) && (
        <ScreenshotModal
          blob={portraitShot ?? undefined}
          filename={`mossling-${mossling.id + 1}.png`}
          kind="portrait"
          problem={portraitProblem ?? undefined}
          onDismiss={() => {
            setPortraitShot(null);
            setPortraitProblem(null);
          }}
        />
      )}
    </dialog>
  );
}
