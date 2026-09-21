import type { PreviewMossling } from "../map-preview";
import type { DisasterThreat, GodContext } from "./types";

type Traits = ReadonlyMap<string, number>;
interface EscapeState {
  panic: number;
  reaction: number;
  credit: number;
  dx: number;
  dy: number;
}
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
const trait = (traits: Traits, label: string) =>
  Math.max(0, Math.min(1, (traits.get(label) ?? 50) / 100));
const unit = (x: number, y: number) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

/** Local danger sensing and bounded escape routing; all durations use game seconds. */
export class DisasterAvoidance {
  private states = new Map<number, EscapeState>();
  private turn = 0;
  constructor(private readonly traitsFor: (id: number) => Traits) {}

  get active() {
    return this.states.size > 0;
  }
  isPanicked(id: number) {
    return (this.states.get(id)?.panic ?? 0) > 0;
  }

  forget(id: number) {
    this.states.delete(id);
  }

  step(dt: number, world: GodContext, threats: DisasterThreat[]) {
    if (dt <= 0) return;
    const width = world.map.width;
    // Read everyone before moving anyone, so herd signals don't cascade across the map.
    const observations = world.mosslings
      .filter((m) => (m.health ?? 100) > 0)
      .map((m) => {
        const genes = this.traitsFor(m.id);
        const x = m.cellIndex % width,
          y = Math.floor(m.cellIndex / width);
        const courage = trait(genes, "Courage"),
          cowardice = trait(genes, "Cowardice");
        const awareness = 2 + cowardice * 4;
        let danger = 0,
          awayX = 0,
          awayY = 0;
        for (const threat of threats) {
          if (threat.alreadyHit?.has(m.id)) continue;
          const distance = Math.hypot(x - threat.x, y - threat.y);
          const tolerance =
            threat.kind === "heat" ? trait(genes, "Heat tolerance") : 0;
          const perceived =
            threat.severity *
            Math.max(0, 1 - distance / (threat.radius + awareness)) *
            (1 - tolerance * 0.4 - trait(genes, "Toughness") * 0.15);
          danger = Math.max(danger, perceived);
          const away = unit(x - threat.x, y - threat.y);
          awayX += away.x * perceived;
          awayY += away.y * perceived;
        }
        const alarm = danger > 0.12 + courage * 0.22;
        const state = this.states.get(m.id);
        return {
          m,
          genes,
          x,
          y,
          courage,
          cowardice,
          danger,
          alarm,
          heading:
            state && (state.dx || state.dy)
              ? unit(state.dx, state.dy)
              : unit(awayX, awayY),
        };
      });
    const buckets = new Map<string, typeof observations>();
    for (const observation of observations) {
      const key = `${Math.floor(observation.x / 4)},${Math.floor(observation.y / 4)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(observation);
      buckets.set(key, bucket);
    }
    const start = this.turn++ % Math.max(1, observations.length);
    for (let i = 0; i < observations.length; i++) {
      const observation = observations[(start + i) % observations.length];
      const { m, genes, x, y, alarm, danger, courage, cowardice } = observation;
      const sociability = trait(genes, "Sociability");
      let herdX = 0,
        herdY = 0,
        herdAlarm = 0,
        neighbors = 0;
      for (let bx = Math.floor(x / 4) - 1; bx <= Math.floor(x / 4) + 1; bx++) {
        for (
          let by = Math.floor(y / 4) - 1;
          by <= Math.floor(y / 4) + 1;
          by++
        ) {
          for (const other of buckets.get(`${bx},${by}`) ?? []) {
            if (
              other.m.id === m.id ||
              !other.alarm ||
              Math.hypot(other.x - x, other.y - y) > 4
            )
              continue;
            herdAlarm = Math.max(herdAlarm, other.danger);
            herdX += other.heading.x + (other.x - x) * 0.12;
            herdY += other.heading.y + (other.y - y) * 0.12;
            neighbors++;
          }
        }
      }
      const sociallyAlarmed = herdAlarm * sociability > 0.2;
      let state = this.states.get(m.id);
      if (!state && !alarm && !sociallyAlarmed) {
        m.panic = 0;
        continue;
      }
      if (!state) {
        state = { panic: 0, reaction: 0, credit: 0, dx: 0, dy: 0 };
        this.states.set(m.id, state);
      }
      state.panic =
        alarm || sociallyAlarmed
          ? Math.max(
              0.45,
              Math.min(
                1,
                danger + cowardice * 0.4 + herdAlarm * sociability * 0.2,
              ),
            )
          : Math.max(0, state.panic - dt * 0.65);
      m.panic = state.panic;
      if (!state.panic) {
        this.states.delete(m.id);
        continue;
      }
      state.reaction += dt;
      // Cautious individuals react sooner; speed controls their independent stride budget.
      if (state.reaction < 0.08 + courage * 0.32) continue;
      state.credit = Math.min(
        1.3,
        state.credit + dt * (1.5 + trait(genes, "Speed") * 4.5),
      );
      if (state.credit + 1e-8 < 1) continue;
      state.credit -= 1;
      const herd = neighbors ? unit(herdX, herdY) : { x: 0, y: 0 };
      this.escape(m, state, world, threats, herd, sociability);
    }
  }

  private escape(
    m: PreviewMossling,
    state: EscapeState,
    world: GodContext,
    threats: DisasterThreat[],
    herd: { x: number; y: number },
    sociability: number,
  ) {
    const width = world.map.width,
      x = m.cellIndex % width,
      y = Math.floor(m.cellIndex / width);
    const risks = new Map<number, number>();
    const risk = (cx: number, cy: number) => {
      const index = cy * width + cx,
        cached = risks.get(index);
      if (cached !== undefined) return cached;
      let worst = 0,
        total = 0;
      for (const threat of threats) {
        if (threat.alreadyHit?.has(m.id)) continue;
        const exposure =
          threat.severity *
          Math.max(
            0,
            1 - Math.hypot(cx - threat.x, cy - threat.y) / (threat.radius + 3),
          );
        worst = Math.max(worst, exposure);
        total += exposure;
      }
      const value = worst + total * 0.1;
      risks.set(index, value);
      return value;
    };
    const initialRisk = risk(x, y);
    // A four-tile search can find a route around a small wall, without teleporting.
    const queue = [{ x, y, dx: 0, dy: 0, depth: 0, peak: initialRisk }];
    const seen = new Set([m.cellIndex]);
    let best: (typeof queue)[number] | undefined,
      bestScore = Infinity;
    const offset = (m.id + this.turn) % DIRECTIONS.length;
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head];
      if (node.depth === 4) continue;
      for (let d = 0; d < DIRECTIONS.length; d++) {
        const [dx, dy] = DIRECTIONS[(d + offset) % DIRECTIONS.length];
        const nx = node.x + dx,
          ny = node.y + dy,
          index = ny * width + nx;
        if (!world.canMoveTo(m, nx, ny) || seen.has(index)) continue;
        seen.add(index);
        const exposure = risk(nx, ny);
        // Herding must not lead an individual deeper into a hazard.
        if (exposure > initialRisk + 0.04) continue;
        const next = {
          x: nx,
          y: ny,
          dx: node.depth ? node.dx : dx,
          dy: node.depth ? node.dy : dy,
          depth: node.depth + 1,
          peak: Math.max(node.peak, exposure),
        };
        queue.push(next);
        const alignment = next.dx * herd.x + next.dy * herd.y;
        const momentum = next.dx * state.dx + next.dy * state.dy;
        const score =
          exposure * 100 +
          next.peak * 15 +
          next.depth * 0.6 -
          alignment * sociability * 2.5 -
          momentum * 0.3;
        if (score < bestScore) {
          bestScore = score;
          best = next;
        }
      }
    }
    if (!best) {
      // A trapped, burning Mossling may make a fatal panic leap into water.
      // Ordinary wandering and escape with an available land route never do this.
      if (world.map.cells[m.cellIndex].burning) {
        for (const [dx, dy] of DIRECTIONS) {
          if (world.cell(x + dx, y + dy)?.terrain !== "water") continue;
          world.forceMove(m, x + dx, y + dy);
          if ((m.health ?? 100) <= 0) break;
        }
      }
      return;
    }
    const before = m.cellIndex;
    world.move(m, x + best.dx, y + best.dy);
    if (m.cellIndex !== before) {
      state.dx = best.dx;
      state.dy = best.dy;
    }
  }
}
