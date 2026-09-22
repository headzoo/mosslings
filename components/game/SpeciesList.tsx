"use client";

import { type Ref, useLayoutEffect, useRef } from "react";
import { paintedMosslingColor, TILE_SIZE } from "@/lib/map-preview";
import type { SpeciesGroup } from "@/lib/species";

const BADGE = 32;
const BADGE_SCALE = 3;
const BADGE_ORIGIN = (BADGE - TILE_SIZE * BADGE_SCALE) / 2;

function badgeColor(
  x: number,
  y: number,
  body: (sx: number, sy: number) => string,
) {
  const dx = x + 0.5 - (BADGE - 1) / 2;
  const dy = y + 0.5 - (BADGE - 1) / 2;
  const distance = Math.hypot(dx, dy);
  if (distance > 15.2) return null;
  if (distance >= 13.15) {
    const light = -dx - dy;
    if (light > 8) return "#f4f8e8";
    if (light > 2) return "#d5e2b4";
    if (light < -6) return "#142018";
    return "#24382c";
  }
  const sx = Math.floor((x - BADGE_ORIGIN) / BADGE_SCALE);
  const sy = Math.floor((y - BADGE_ORIGIN) / BADGE_SCALE);
  if (sx < 0 || sy < 0 || sx >= TILE_SIZE || sy >= TILE_SIZE) return "#102018";
  return body(sx, sy);
}

function SpeciesSwatch({
  id,
  pattern,
  colors,
}: {
  id: number;
  pattern: number;
  colors: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const palette = colors.join(",");
  useLayoutEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!context) return;
    const healthy = {
      id,
      pattern,
      colors: palette.split(","),
      cellIndex: 0,
      health: 100,
    };
    context.clearRect(0, 0, BADGE, BADGE);
    context.imageSmoothingEnabled = false;
    for (let y = 0; y < BADGE; y++) {
      for (let x = 0; x < BADGE; x++) {
        const color = badgeColor(x, y, (sx, sy) =>
          paintedMosslingColor(healthy, sx, sy),
        );
        if (!color) continue;
        context.fillStyle = color;
        context.fillRect(x, y, 1, 1);
      }
    }
  }, [id, pattern, palette]);
  return (
    <canvas
      ref={ref}
      className="species-swatch"
      width={BADGE}
      height={BADGE}
      aria-hidden
    />
  );
}

export function SpeciesList({
  ref,
  groups,
  selectedKey,
  onSelect,
  highlighted = false,
}: {
  ref?: Ref<HTMLElement>;
  groups: SpeciesGroup[];
  selectedKey: string | null;
  onSelect: (group: SpeciesGroup) => void;
  highlighted?: boolean;
}) {
  return (
    <section
      ref={ref}
      className={`species-list panel${highlighted ? " species-list--intro-highlight" : ""}`}
      aria-label="Species"
    >
      <h2>Species</h2>
      {groups.length === 0 ? (
        <p className="species-empty">No Mosslings</p>
      ) : (
        <ol>
          {groups.map((group) => {
            const sample = group.members[0];
            return (
              <li key={group.key}>
                <button
                  type="button"
                  aria-pressed={selectedKey === group.key}
                  aria-label={`${group.name}, ${group.count} ${group.count === 1 ? "Mossling" : "Mosslings"}`}
                  onClick={() => onSelect(group)}
                >
                  {sample && (
                    <SpeciesSwatch
                      id={sample.id}
                      pattern={sample.pattern}
                      colors={sample.colors}
                    />
                  )}
                  <span className="species-name">{group.name}</span>
                  <span className="species-count">{group.count}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
