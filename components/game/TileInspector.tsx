"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";
import type { MapCell } from "@/lib/map";
import { type PreviewMossling, terrainColor } from "@/lib/map-preview";
import { previewTraits } from "@/lib/mossling-traits";

import { MosslingPortrait } from "./MosslingPortrait";

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
      "Water gathers in this low patch of ground. A cool, wet interruption in the landscape, separating the dry land around it.",
  },
};
const cropInfo = {
  title: "Crops",
  description:
    "A sown patch. It starts as green growth and, over six rainy months, draws itself into rows. Without rain the crop withers, and hungry Mosslings weaken.",
};
export function TileInspector({
  seed,
  index,
  x,
  y,
  cell,
  mossling,
  hostRef,
  onClose,
  elapsed,
}: {
  seed: number;
  index: number;
  x: number;
  y: number;
  cell: MapCell;
  mossling?: PreviewMossling;
  hostRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  elapsed?: () => number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const crop = cell.growth !== undefined && !cell.tree;
  const info = cell.tree
    ? {
        title: "Tree",
        description:
          "A small mossy tree takes root here, offering a patch of shade. Fire and storms can damage it.",
      }
    : crop
      ? cropInfo
      : terrainInfo[cell.terrain];
  const traits = mossling
    ? (mossling.traits ?? previewTraits(seed, mossling.id))
    : [];
  const title = mossling ? `Mossling #${mossling.id + 1}` : info.title;
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const host = hostRef.current;
    if (!dialog || !host) return;
    const position = () => {
      const rect = host.getBoundingClientRect();
      dialog.style.left = `${rect.left + rect.width / 2}px`;
      dialog.style.top = `${rect.top + rect.height / 2}px`;
      dialog.style.width = `${Math.max(0, Math.min(420, rect.width - 16))}px`;
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
  return (
    <dialog
      ref={dialogRef}
      className="tile-inspector panel"
      aria-labelledby="tile-inspector-title"
      onClose={() => {
        if (!dialogRef.current?.open) onClose();
      }}
    >
      <header className="inspector-header">
        <div>
          <p className="inspector-eyebrow">
            {mossling ? "Meet a Mossling" : "A little patch of world"}
          </p>
          <h2 id="tile-inspector-title">{title}</h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close tile information"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="inspector-content">
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
            Crops:{" "}
            {(cell.growth ?? 0) >= 1
              ? "ripe"
              : (cell.growth ?? 0) <= 0
                ? "just planted"
                : `${Math.round((cell.growth ?? 0) * 100)}% grown`}
          </p>
        )}
        {mossling && (
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
            {(mossling.panic ?? 0) > 0.1 && " · Panicked — trying to escape"}
            {mossling.ritual?.phase === "courtship" && " · Courting"}
            {mossling.ritual?.phase === "family" && " · Staying with family"}
          </p>
        )}
        {mossling?.parents && (
          <p className="tile-coordinate">
            Child of Mossling #{mossling.parents[0] + 1} and #
            {mossling.parents[1] + 1}
          </p>
        )}
        {mossling ? (
          <>
            <div className="mossling-introduction">
              <MosslingPortrait mossling={mossling} elapsed={elapsed} />
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
              <span
                className="terrain-sample"
                style={{ background: terrainColor(cell, index) }}
                aria-hidden="true"
              />
              <p>{info.description}</p>
            </div>
            <h3>Ground conditions</h3>
            <dl className="tile-conditions">
              {(
                [
                  ["Elevation", cell.elevation],
                  ["Moisture", cell.moisture],
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
    </dialog>
  );
}
