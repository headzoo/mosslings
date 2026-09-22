"use client";

import { useLayoutEffect, useRef } from "react";
import { paintedMosslingColor, TILE_SIZE } from "@/lib/map-preview";
import type { SpeciesGroup } from "@/lib/species";

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
    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        context.fillStyle = paintedMosslingColor(healthy, x, y, 0);
        context.fillRect(x, y, 1, 1);
      }
    }
  }, [id, pattern, palette]);
  return (
    <canvas
      ref={ref}
      className="species-swatch"
      width={TILE_SIZE}
      height={TILE_SIZE}
      aria-hidden
    />
  );
}

export function SpeciesList({
  groups,
  selectedKey,
  onSelect,
}: {
  groups: SpeciesGroup[];
  selectedKey: string | null;
  onSelect: (group: SpeciesGroup) => void;
}) {
  return (
    <section className="species-list panel" aria-label="Species">
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
