import { chebyshev, PLAGUE_BLAST } from "../disease";
import { effect, noise } from "../shared";
import type { GodAction } from "../types";

const SKULL = [
  ".ggggg.",
  "ggggggg",
  "gk.g.kg",
  "ggggggg",
  ".ggggg.",
  "..ggg..",
  ".g...g.",
];

export const disease: GodAction = {
  id: "disease",
  label: "Disease",
  create: (point, seed, id) =>
    effect("disease", point, seed, id, 2, PLAGUE_BLAST),
  update(e, world) {
    if (e.step !== 0) return;
    const width = world.map.width;
    for (const m of world.mosslings) {
      if ((m.health ?? 100) <= 0 || m.plagueMonths !== undefined) continue;
      const x = m.cellIndex % width;
      const y = Math.floor(m.cellIndex / width);
      if (chebyshev(x, y, e.x, e.y) <= PLAGUE_BLAST) e.hit.add(m.id);
    }
    for (const m of world.mosslings) if (e.hit.has(m.id)) m.plagueMonths = 0;
  },
  draw(e, p) {
    const progress = Math.min(1, e.age / e.duration);
    const fade = 1 - progress;
    const rise = progress * 10;
    // Opens at the 12-tile blast, then lifts and shrinks into the smoke.
    const span = 12 * (1 - progress * 0.82);
    const columns = SKULL[0].length;
    const pixel = span / columns;
    const left = e.x + 0.5 - span / 2;
    const top = e.y + 0.5 - (SKULL.length * pixel) / 2 - rise;
    const skullFade =
      progress < 0.35 ? 1 : Math.max(0, 1 - (progress - 0.35) / 0.65);
    for (let i = 0; i < 18; i++) {
      const angle = noise(i + 3) * Math.PI * 2;
      const spread =
        (span / 2) * (0.45 + noise(i + 11)) * (0.35 + progress * 0.9);
      p.cell(
        e.x + 0.5 + Math.cos(angle) * spread,
        e.y + 0.5 - rise * 0.75 + Math.sin(angle) * spread * 0.35,
        i % 2 ? "#bdbdbd" : "#8a8a8a",
        pixel * (0.55 + noise(i + 7) * 0.7),
        fade * (0.35 + noise(i + 5) * 0.45),
      );
    }
    for (let y = 0; y < SKULL.length; y++) {
      for (let x = 0; x < SKULL[y].length; x++) {
        const mark = SKULL[y][x];
        if (mark === ".") continue;
        p.cell(
          left + x * pixel,
          top + y * pixel,
          mark === "k" ? "#2a2a2a" : "#c8c8c8",
          pixel,
          skullFade,
        );
      }
    }
  },
};
