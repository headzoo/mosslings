import { advanceCrops, appetite, cropFoodSupply } from "../crops";
import {
  foliageAt,
  type GameDate,
  gameDateAt,
  MONTH_SECONDS,
} from "../game-time";
import type { MapData } from "../map";
import type { PreviewMossling } from "../map-preview";
import { previewTraits } from "../mossling-traits";
import {
  ResourceHistory,
  type ResourceHistorySample,
  sampleFromResources,
} from "../resource-history";
import { advanceVegetation } from "../vegetation";
import { countWorldResources, type WorldResources } from "../world-resources";
import { GOD_ACTIONS } from "./actions";
import { DisasterAvoidance } from "./avoidance";
import {
  catchRange,
  chebyshev,
  PLAGUE_DEATH_MONTH,
  PLAGUE_SENSE,
  plagueHeading,
} from "./disease";
import { WorldEcology } from "./ecology";
import { mateMonth } from "./mating";
import { addToBucket, eachInReach } from "./shared";
import type {
  EffectPainter,
  GodContext,
  GodEffect,
  Point,
  PowerId,
  WorldEvent,
} from "./types";
import {
  accumulateFlood,
  floodRadius,
  lightningUnderRain,
  rollMonth,
} from "./weather";

export interface WorldView {
  mosslings: PreviewMossling[];
  events: WorldEvent[];
  resources: WorldResources;
  resourceHistory: ResourceHistorySample[];
}

export interface WorldSnapshot extends WorldView {
  map: MapData;
}
const MAX_EFFECTS = 16;
export const EFFECT_CAP_MESSAGE = "Let a few active powers finish first.";
const caught = (count: number) =>
  `${count} Mossling${count === 1 ? "" : "s"} caught the black death.`;

export class GodWorld {
  readonly map: MapData;
  /** Bumped when the map changes so canvases can repaint without a new object. */
  revision = 0;
  mosslings: PreviewMossling[];
  effects: GodEffect[] = [];
  events: WorldEvent[];
  private nextId = 1;
  private nextMosslingId = 1;
  private nextEventId = 1;
  private killed = 0;
  private born = 0;
  private drowned = new Set<number>();
  private starved = new Set<number>();
  private occupied = new Map<number, PreviewMossling>();
  private resistance = new Map<number, Map<string, number>>();
  private ecology: WorldEcology;
  private elapsed = 0;
  private nextMonth = MONTH_SECONDS;
  private randomState: number;
  private weatherState: number;
  private flood = new Map<number, number>();
  private pendingStorm: Point | null = null;
  private advancing = false;
  private avoidance: DisasterAvoidance;
  private resourceHistory = ResourceHistory.empty();
  readonly context: GodContext;

  constructor(
    map: MapData,
    mosslings: PreviewMossling[],
    private readonly getDate: () => GameDate = () => ({
      year: 1,
      season: "Summer",
    }),
  ) {
    const date = this.getDate();
    this.events = [
      {
        id: 0,
        message: "A little world is ready. Choose a power and a place.",
        ...date,
      },
    ];
    this.map = {
      ...map,
      cells: map.cells.map((cell) => ({
        ...cell,
        tree: cell.tree ? { ...cell.tree } : undefined,
      })),
    };
    this.mosslings = mosslings.map((m) => {
      const health = m.health ?? 100;
      return {
        ...m,
        health,
        corpseMonths: health <= 0 ? (m.corpseMonths ?? 0) : m.corpseMonths,
        colors: [...m.colors],
        traits: (m.traits ?? previewTraits(map.seed, m.id)).map((trait) => ({
          ...trait,
        })),
        wontMate: m.wontMate ? [...m.wontMate] : undefined,
        parents: m.parents ? ([...m.parents] as [number, number]) : undefined,
        ritual: m.ritual ? { ...m.ritual } : undefined,
      };
    });
    this.nextMosslingId =
      this.mosslings.reduce((max, m) => Math.max(max, m.id), -1) + 1;
    this.ecology = new WorldEcology(this.map);
    this.randomState = map.seed;
    this.weatherState = (map.seed ^ 0x51f15e) >>> 0;
    for (const m of this.mosslings) {
      this.occupied.set(m.cellIndex, m);
      this.resistance.set(
        m.id,
        new Map((m.traits ?? []).map((trait) => [trait.label, trait.value])),
      );
    }
    this.avoidance = new DisasterAvoidance(
      (id) => this.resistance.get(id) ?? new Map(),
    );
    this.context = {
      map: this.map,
      mosslings: this.mosslings,
      cell: (x, y) =>
        Number.isInteger(x) &&
        Number.isInteger(y) &&
        x >= 0 &&
        y >= 0 &&
        x < this.map.width &&
        y < this.map.height
          ? this.map.cells[y * this.map.width + x]
          : undefined,
      area: (x, y, radius, visit) => {
        for (
          let cy = Math.max(0, Math.floor(y - radius));
          cy <= Math.min(this.map.height - 1, Math.ceil(y + radius));
          cy++
        ) {
          for (
            let cx = Math.max(0, Math.floor(x - radius));
            cx <= Math.min(this.map.width - 1, Math.ceil(x + radius));
            cx++
          ) {
            const distance = Math.hypot(cx - x, cy - y);
            if (distance <= radius)
              visit(
                this.map.cells[cy * this.map.width + cx],
                cy * this.map.width + cx,
                distance,
              );
          }
        }
      },
      damage: (index, amount, kind) => {
        const m = this.occupied.get(index);
        if (!m || amount <= 0 || (m.health ?? 100) <= 0) return;
        const traits = this.resistance.get(m.id);
        const toughness = (traits?.get("Toughness") ?? 0) / 100;
        const tolerance =
          kind === "heat"
            ? (traits?.get("Heat tolerance") ?? 0) / 100
            : kind === "water"
              ? (traits?.get("Water tolerance") ?? 0) / 100
              : 0;
        m.health = Math.max(
          0,
          (m.health ?? 100) -
            amount * Math.max(0.2, 1 - toughness * 0.35 - tolerance * 0.45),
        );
      },
      damageTree: (cell, amount) => {
        if (!cell.tree || amount <= 0) return;
        this.ecology.damage(cell, this.elapsed);
        cell.tree.health -= amount;
        if (cell.tree.health <= 0) cell.tree = undefined;
      },
      damageTerrain: (cell) => this.ecology.damage(cell, this.elapsed),
      clearRecovery: (cell) => this.ecology.clear(cell),
      canMoveTo: (m, x, y) => {
        const cell = this.context.cell(x, y);
        if (
          !cell ||
          cell.tree ||
          cell.burning ||
          cell.terrain === "water" ||
          cell.terrain === "rock" ||
          (m.health ?? 100) <= 0
        )
          return false;
        const index = y * this.map.width + x;
        return !this.occupied.has(index) && this.ecology.canEnter(index);
      },
      move: (m, x, y) => {
        if (!this.context.canMoveTo(m, x, y)) return;
        const index = y * this.map.width + x;
        this.occupied.delete(m.cellIndex);
        m.cellIndex = index;
        this.occupied.set(index, m);
      },
      forceMove: (m, x, y) => {
        if ((m.health ?? 100) <= 0 || !this.context.cell(x, y)) return;
        const fromX = m.cellIndex % this.map.width;
        const fromY = Math.floor(m.cellIndex / this.map.width);
        const steps = Math.max(Math.abs(x - fromX), Math.abs(y - fromY));
        // Trace the shove: a storm cannot carry a Mossling across water unharmed.
        for (let step = 1; step <= steps; step++) {
          const nx = Math.round(fromX + ((x - fromX) * step) / steps);
          const ny = Math.round(fromY + ((y - fromY) * step) / steps);
          const cell = this.context.cell(nx, ny);
          const index = ny * this.map.width + nx;
          if (
            !cell ||
            cell.tree ||
            cell.terrain === "rock" ||
            this.occupied.has(index) ||
            (cell.terrain !== "water" && !this.ecology.canEnter(index))
          )
            return;
          this.occupied.delete(m.cellIndex);
          m.cellIndex = index;
          if (cell.terrain === "water") {
            m.health = 0;
            this.drowned.add(m.id);
            this.occupied.set(index, m);
            return;
          }
          this.occupied.set(index, m);
        }
      },
    };
    this.removeDead();
    this.recordResourceHistory();
  }
  private recordResourceHistory() {
    this.resourceHistory.record(
      sampleFromResources(
        countWorldResources(
          this.map,
          this.mosslings,
          this.killed,
          this.born,
          foliageAt(this.elapsed).crop,
        ),
      ),
    );
  }
  private record(message: string) {
    this.events = [
      {
        id: this.nextEventId++,
        message,
        ...(this.advancing ? gameDateAt(this.elapsed) : this.getDate()),
      },
      ...this.events,
    ].slice(0, 30);
  }
  private recordTagged(tag: WorldEvent["tag"]) {
    this.events = [
      {
        id: this.nextEventId++,
        message: "",
        tag,
        ...(this.advancing ? gameDateAt(this.elapsed) : this.getDate()),
      },
      ...this.events,
    ].slice(0, 30);
  }
  cast(
    kind: PowerId,
    x: number,
    y: number,
    tune: { quiet?: boolean } = {},
  ): string | null {
    return this.begin(kind, x, y, tune);
  }
  moveMossling(id: number, x: number, y: number): string | null {
    const source = this.mosslings.find((m) => m.id === id);
    if (!source || (source.health ?? 100) <= 0) return "That Mossling is gone.";
    if (!this.context.cell(x, y)) return "Choose a tile inside the map.";
    const destIndex = y * this.map.width + x;
    if (source.cellIndex === destIndex) return null;
    const error = this.mosslingDestinationError(source, x, y);
    if (error) return error;
    this.context.move(source, x, y);
    this.revision++;
    return null;
  }
  cloneMossling(id: number, x: number, y: number): string | null {
    const source = this.mosslings.find((m) => m.id === id);
    if (!source || (source.health ?? 100) <= 0) return "That Mossling is gone.";
    if (!this.context.cell(x, y)) return "Choose a tile inside the map.";
    const error = this.mosslingDestinationError(source, x, y);
    if (error) return error;
    const index = y * this.map.width + x;
    const newId = this.nextMosslingId++;
    const traits = (source.traits ?? []).map((trait) => ({ ...trait }));
    const clone: PreviewMossling = {
      id: newId,
      cellIndex: index,
      health: source.health ?? 100,
      colors: [...source.colors],
      pattern: source.pattern,
      traits,
      hungry: source.hungry,
    };
    this.mosslings.push(clone);
    this.occupied.set(index, clone);
    this.resistance.set(
      clone.id,
      new Map(traits.map((trait) => [trait.label, trait.value])),
    );
    this.born += 1;
    this.record("1 Mossling was cloned.");
    this.revision++;
    return null;
  }
  private mosslingDestinationError(
    source: PreviewMossling,
    x: number,
    y: number,
  ): string | null {
    if (this.context.canMoveTo(source, x, y)) return null;
    const cell = this.context.cell(x, y);
    if (!cell) return "Choose a tile inside the map.";
    if (cell.tree) return "That tile has a tree.";
    if (cell.burning)
      return "Put out the fire before placing a Mossling there.";
    if (cell.terrain === "water") return "Mosslings cannot stand on water.";
    if (cell.terrain === "rock") return "Mosslings cannot stand on stone.";
    const index = y * this.map.width + x;
    if (this.occupied.has(index)) return "That tile is already occupied.";
    if (!this.ecology.canEnter(index)) return "That ground is not ready yet.";
    return "That tile is not a safe place for a Mossling.";
  }
  /** Crops and lightning finish on their first step; the slot after that is only a flash. */
  private freeFlash(kind: PowerId) {
    if (kind !== "raze" && kind !== "lightning") return;
    const index = this.effects.findIndex(
      (effect) =>
        (effect.kind === "raze" || effect.kind === "lightning") &&
        effect.step > 0,
    );
    if (index >= 0) this.effects.splice(index, 1);
  }
  private begin(
    kind: PowerId,
    x: number,
    y: number,
    tune: {
      duration?: number;
      intensity?: number;
      message?: string;
      quiet?: boolean;
    },
  ): string | null {
    if (!this.context.cell(x, y)) return "Choose a tile inside the map.";
    if (this.effects.length >= MAX_EFFECTS) this.freeFlash(kind);
    if (this.effects.length >= MAX_EFFECTS) return EFFECT_CAP_MESSAGE;
    const action = GOD_ACTIONS[kind];
    const invalid = action.canPlace?.(this.context, { x, y });
    if (invalid) {
      if (!tune.quiet && tune.message === undefined) this.record(invalid);
      return invalid;
    }
    const id = this.nextId++;
    const e = action.create(
      { x, y },
      (this.map.seed ^ Math.imul(id, 0x9e3779b9)) >>> 0,
      id,
    );
    if (tune.duration !== undefined) e.duration = tune.duration;
    if (tune.intensity !== undefined) e.intensity = tune.intensity;
    action.update(e, this.context, 0);
    e.step++;
    this.effects.push(e);
    if (tune.message) this.record(tune.message);
    else if (!tune.quiet) this.record(`${action.label} at tile ${x}, ${y}.`);
    if (e.kind === "disease" && e.hit.size) this.record(caught(e.hit.size));
    if (e.kind === "raze" && e.hit.size)
      this.recordTagged("player-crop-planted");
    this.removeDead();
    this.revision++;
    return null;
  }
  private weatherRandom() {
    this.weatherState =
      (Math.imul(this.weatherState, 1664525) + 1013904223) >>> 0;
    return this.weatherState / 4294967296;
  }
  private rollWeather() {
    const roll = rollMonth(
      this.map,
      () => this.weatherRandom(),
      MAX_EFFECTS - this.effects.length,
      this.pendingStorm,
      (kind, point) => !GOD_ACTIONS[kind].canPlace?.(this.context, point),
    );
    this.pendingStorm = roll.pendingStorm;
    for (const spawn of roll.spawns)
      this.begin(spawn.kind, spawn.x, spawn.y, {
        duration: spawn.duration,
        intensity: spawn.intensity,
        message: spawn.message,
      });
    if (roll.floodAt)
      floodRadius(this.map, roll.floodAt, (cell) => this.ecology.clear(cell));
  }
  private soak(dt: number) {
    const flooded = accumulateFlood(
      this.map,
      this.effects,
      this.flood,
      dt,
      (cell) => this.ecology.clear(cell),
    );
    if (flooded)
      this.record(
        `The flood claims ${flooded} tile${flooded === 1 ? "" : "s"}.`,
      );
  }
  private spark(dt: number) {
    const bolts = lightningUnderRain(
      this.map,
      this.effects,
      dt,
      () => this.weatherRandom(),
      MAX_EFFECTS - this.effects.length,
    );
    for (const bolt of bolts)
      this.begin(bolt.kind, bolt.x, bolt.y, { message: bolt.message });
  }
  private removeDead() {
    let drowned = 0;
    let starved = 0;
    let elemental = 0;
    const kept: PreviewMossling[] = [];
    for (const m of this.mosslings) {
      if (
        (m.health ?? 100) > 0 &&
        this.map.cells[m.cellIndex]?.terrain === "water"
      ) {
        m.health = 0;
        this.drowned.add(m.id);
      }
      if ((m.health ?? 100) > 0) {
        kept.push(m);
        continue;
      }
      if ((m.corpseMonths ?? 0) >= 1) {
        if (this.occupied.get(m.cellIndex) === m)
          this.occupied.delete(m.cellIndex);
        this.avoidance.forget(m.id);
        this.resistance.delete(m.id);
        continue;
      }
      if (m.corpseMonths === undefined) {
        m.corpseMonths = 0;
        this.avoidance.forget(m.id);
        if (!this.occupied.has(m.cellIndex)) this.occupied.set(m.cellIndex, m);
        if (this.drowned.delete(m.id)) drowned++;
        else if (this.starved.delete(m.id)) starved++;
        else elemental++;
      }
      kept.push(m);
    }
    this.mosslings = kept;
    this.context.mosslings = this.mosslings;
    this.releaseRituals();
    this.killed += drowned + starved + elemental;
    if (drowned)
      this.record(`${drowned} Mossling${drowned === 1 ? "" : "s"} drowned.`);
    if (starved)
      this.record(`${starved} Mossling${starved === 1 ? "" : "s"} starved.`);
    if (elemental)
      this.record(
        `${elemental} Mossling${elemental === 1 ? "" : "s"} lost to the elements.`,
      );
  }
  tick(dt: number) {
    // The UI advances in fixed 50ms steps; clamp callers to avoid giant jumps.
    dt = Math.min(0.05, Math.max(0, dt));
    const threats = this.effects.flatMap(
      (e) => GOD_ACTIONS[e.kind].threats?.(e, this.context) ?? [],
    );
    if (threats.length || this.avoidance.active) {
      this.avoidance.step(dt, this.context, threats);
      this.spreadPlague();
    }
    for (const e of this.effects) {
      e.age = Math.min(e.duration, e.age + dt);
      GOD_ACTIONS[e.kind].update(e, this.context, dt);
      e.step++;
    }
    this.soak(dt);
    this.spark(dt);
    this.removeDead();
    this.effects = this.effects.filter((e) => {
      if (e.age < e.duration) return true;
      GOD_ACTIONS[e.kind].finish?.(e, this.context);
      this.record(`${GOD_ACTIONS[e.kind].label} has faded.`);
      return false;
    });
  }
  /** Advance the played world to the absolute game clock, including skipped months. */
  advanceTo(seconds: number): boolean {
    if (!Number.isFinite(seconds) || seconds <= this.elapsed) return false;
    let changed = false;
    this.advancing = true;
    while (this.elapsed + 1e-8 < seconds) {
      const end = Math.min(seconds, this.nextMonth);
      if (this.effects.length || this.avoidance.active) {
        const dt = Math.min(0.05, end - this.elapsed);
        this.elapsed += dt;
        this.tick(dt);
        changed = true;
      } else this.elapsed = end;
      if (this.elapsed + 1e-8 >= this.nextMonth) {
        this.elapsed = this.nextMonth;
        this.ageCorpses();
        this.agePlague();
        const holding = this.mate();
        this.wander(holding);
        this.spreadPlague();
        const result = this.ecology.month(
          this.elapsed,
          new Set(this.occupied.keys()),
        );
        const look = foliageAt(this.elapsed);
        const withered = advanceCrops(this.map, look.crop);
        advanceVegetation(this.map);
        this.feed(look.crop);
        this.rollWeather();
        this.removeDead();
        if (result.repaired)
          this.record(`${result.repaired} tiles have recovered.`);
        if (result.trees)
          this.record(`The forest spread into ${result.trees} tiles.`);
        if (withered)
          this.record(
            `The crops withered on ${withered} tile${withered === 1 ? "" : "s"}.`,
          );
        this.recordResourceHistory();
        this.nextMonth += MONTH_SECONDS;
        changed = true;
      }
    }
    this.advancing = false;
    if (changed) this.revision++;
    return changed;
  }

  private feed(cropCover: number) {
    const living = this.mosslings.filter((m) => (m.health ?? 100) > 0);
    if (living.length === 0) return;
    const supply = cropFoodSupply(this.map, cropCover);
    const demand = living.reduce((sum, m) => sum + appetite(m.traits), 0);
    const ratio = demand <= 0 ? 1 : supply / demand;
    const perHead = supply / living.length;
    const starving = perHead <= 0.25;
    for (const m of living) {
      const health = m.health ?? 100;
      if (ratio >= 1) {
        m.hungry = false;
        if (health < 100)
          m.health = Math.min(
            100,
            health + Math.max(1, Math.round((100 - health) * 0.35)),
          );
        continue;
      }
      m.hungry = true;
      const loss = Math.max(
        1,
        Math.round(appetite(m.traits) * (1 - ratio) * 18),
      );
      const next = health - loss;
      m.health = starving ? Math.max(0, next) : Math.max(1, next);
    }
    const markStarved = () => {
      for (const m of living)
        if ((m.health ?? 100) <= 0) this.starved.add(m.id);
    };
    markStarved();
    // A full table of health can last a foodless winter. The monthly cull would
    // kill someone every month even at 100 health, so winter spends health only.
    if (cropCover <= 0 || !starving) return;
    const deaths = Math.min(
      living.length,
      Math.max(1, Math.ceil((0.25 - perHead) * living.length)),
    );
    const ranked = [...living].sort((a, b) => {
      const gap = appetite(b.traits) - appetite(a.traits);
      if (Math.abs(gap) > 1e-9) return gap;
      return (a.health ?? 100) - (b.health ?? 100);
    });
    for (const m of ranked.slice(0, deaths)) m.health = 0;
    markStarved();
  }

  private ageCorpses() {
    for (const m of this.mosslings)
      if (m.corpseMonths !== undefined) m.corpseMonths++;
  }

  private agePlague() {
    let deaths = 0;
    for (const m of this.mosslings) {
      if (m.plagueMonths === undefined) continue;
      m.plagueMonths++;
      if (m.plagueMonths === PLAGUE_DEATH_MONTH && (m.health ?? 100) > 0) {
        m.health = 0;
        m.corpseMonths = 0;
        this.killed++;
        this.avoidance.forget(m.id);
        deaths++;
      }
    }
    if (deaths)
      this.record(
        `${deaths} Mossling${deaths === 1 ? "" : "s"} succumbed to the black death.`,
      );
  }

  private carrierBuckets() {
    const width = this.map.width;
    const buckets = new Map<
      string,
      { id: number; x: number; y: number; order: number }[]
    >();
    let count = 0;
    this.mosslings.forEach((carrier, order) => {
      if (carrier.plagueMonths === undefined) return;
      count++;
      addToBucket(
        buckets,
        carrier.cellIndex % width,
        Math.floor(carrier.cellIndex / width),
        {
          id: carrier.id,
          x: carrier.cellIndex % width,
          y: Math.floor(carrier.cellIndex / width),
          order,
        },
      );
    });
    return count > 0 ? buckets : null;
  }

  private spreadPlague() {
    const carriers = this.carrierBuckets();
    if (!carriers) return;
    const width = this.map.width;
    let infected = 0;
    for (const m of this.mosslings) {
      if (m.plagueMonths !== undefined || (m.health ?? 100) <= 0) continue;
      const range = catchRange(
        this.resistance.get(m.id)?.get("Toughness") ?? 50,
      );
      const x = m.cellIndex % width;
      const y = Math.floor(m.cellIndex / width);
      let hit = false;
      eachInReach(carriers, x, y, range, (carrier) => {
        if (hit) return;
        if (chebyshev(x, y, carrier.x, carrier.y) <= range) hit = true;
      });
      if (!hit) continue;
      m.plagueMonths = 0;
      infected++;
    }
    if (infected) this.record(caught(infected));
  }

  private nearestCarrier(
    carriers: Map<
      string,
      { id: number; x: number; y: number; order: number }[]
    >,
    x: number,
    y: number,
    id: number,
  ) {
    let best:
      | { x: number; y: number; distance: number; order: number }
      | undefined;
    eachInReach(carriers, x, y, PLAGUE_SENSE, (carrier) => {
      if (carrier.id === id) return;
      const distance = chebyshev(x, y, carrier.x, carrier.y);
      if (distance > PLAGUE_SENSE) return;
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && carrier.order < best.order)
      )
        best = { x: carrier.x, y: carrier.y, distance, order: carrier.order };
    });
    return best;
  }

  private diseaseHeading(m: PreviewMossling, random: () => number) {
    const genes = this.resistance.get(m.id);
    const value = (label: string) =>
      Math.max(0, Math.min(1, (genes?.get(label) ?? 50) / 100));
    const sociability = value("Sociability");
    const cowardice = value("Cowardice");
    if (sociability > cowardice) return true;
    return plagueHeading(sociability, cowardice, value("Curiosity"), random());
  }

  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }

  private releaseRituals() {
    const living = new Set(
      this.mosslings.filter((m) => (m.health ?? 100) > 0).map((m) => m.id),
    );
    for (const m of this.mosslings) {
      const ritual = m.ritual;
      if (!ritual || (m.health ?? 100) <= 0) {
        if ((m.health ?? 100) <= 0) m.ritual = undefined;
        continue;
      }
      if (ritual.role === "child") {
        const parentsOk = (m.parents ?? []).every((id) => living.has(id));
        if (!parentsOk || !living.has(ritual.partnerId)) m.ritual = undefined;
        continue;
      }
      const childOk = ritual.childId == null || living.has(ritual.childId);
      if (!living.has(ritual.partnerId) || !childOk) m.ritual = undefined;
    }
  }

  private mate() {
    const { born, busy } = mateMonth({
      mosslings: this.mosslings,
      width: this.map.width,
      height: this.map.height,
      elapsed: this.elapsed,
      random: () => this.random(),
      isPanicked: (id) => this.avoidance.isPanicked(id),
      canMoveTo: (m, x, y) => this.context.canMoveTo(m, x, y),
      move: (m, x, y) => this.context.move(m, x, y),
      spawn: (child) => {
        this.mosslings.push(child);
        this.occupied.set(child.cellIndex, child);
        this.resistance.set(
          child.id,
          new Map(
            (child.traits ?? []).map((trait) => [trait.label, trait.value]),
          ),
        );
      },
      nextId: () => this.nextMosslingId++,
    });
    this.born += born;
    if (born === 1) this.record("1 Mossling was born.");
    else if (born > 1) this.record(`${born} Mosslings were born.`);
    return busy;
  }

  private wander(holding: ReadonlySet<number>) {
    const random = () => this.random();
    const carriers = this.carrierBuckets();
    // Rotate visitation order. Healthy Mosslings near the black death
    // bias that step; everyone else still shuffles their neighbors.
    const start = Math.floor(random() * this.mosslings.length);
    for (let i = 0; i < this.mosslings.length; i++) {
      const m = this.mosslings[(start + i) % this.mosslings.length];
      if (
        (m.health ?? 100) <= 0 ||
        this.avoidance.isPanicked(m.id) ||
        holding.has(m.id)
      )
        continue;
      const origin = m.cellIndex,
        x = origin % this.map.width,
        y = Math.floor(origin / this.map.width);
      const carrier =
        m.plagueMonths === undefined && carriers
          ? this.nearestCarrier(carriers, x, y, m.id)
          : undefined;
      const toward = carrier ? this.diseaseHeading(m, random) : null;
      const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (let j = directions.length - 1; j > 0; j--) {
        const pick = Math.floor(random() * (j + 1));
        [directions[j], directions[pick]] = [directions[pick], directions[j]];
      }
      if (carrier && toward !== null) {
        let chosen: number[] | undefined;
        let bestDistance = 0;
        for (const step of directions) {
          const nx = x + step[0];
          const ny = y + step[1];
          if (!this.context.canMoveTo(m, nx, ny)) continue;
          const distance = chebyshev(nx, ny, carrier.x, carrier.y);
          if (
            !chosen ||
            (toward ? distance < bestDistance : distance > bestDistance)
          ) {
            chosen = step;
            bestDistance = distance;
          }
        }
        if (chosen) {
          this.context.move(m, x + chosen[0], y + chosen[1]);
          continue;
        }
      }
      for (const [dx, dy] of directions) {
        this.context.move(m, x + dx, y + dy);
        if (m.cellIndex !== origin) break;
      }
    }
  }
  private copyMosslings(): PreviewMossling[] {
    return this.mosslings.map((m) => ({
      ...m,
      colors: [...m.colors],
      traits: m.traits?.map((trait) => ({ ...trait })),
      wontMate: m.wontMate ? [...m.wontMate] : undefined,
      parents: m.parents ? ([...m.parents] as [number, number]) : undefined,
      ritual: m.ritual ? { ...m.ritual } : undefined,
    }));
  }
  /** UI publish. The live map stays on the engine; canvases repaint from revision. */
  view(): WorldView {
    return {
      mosslings: this.copyMosslings(),
      events: [...this.events],
      resources: countWorldResources(
        this.map,
        this.mosslings,
        this.killed,
        this.born,
        foliageAt(this.elapsed).crop,
      ),
      resourceHistory: this.resourceHistory.values(),
    };
  }
  snapshot(): WorldSnapshot {
    return {
      ...this.view(),
      map: {
        ...this.map,
        cells: this.map.cells.map((c) => ({
          ...c,
          tree: c.tree ? { ...c.tree } : undefined,
        })),
      },
    };
  }
  draw(painter: EffectPainter) {
    const season = gameDateAt(this.elapsed).season;
    const painted = { ...painter, season };
    for (const e of this.effects) GOD_ACTIONS[e.kind].draw(e, painted);
  }
}
