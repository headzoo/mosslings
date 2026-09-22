import assert from "node:assert/strict";
import test from "node:test";
import {
  ADVISORY_REPEAT_MS,
  type AdvisoryMemory,
  type AdvisoryWorld,
  APPROVAL_HIGH_ABOVE,
  APPROVAL_LOW_BELOW,
  EMPTY_ADVISORY_MEMORY,
  HEALTH_ADVISORY_BELOW,
  stepAdvisory,
} from "../lib/advisories";
import { CROP_GROW_MOISTURE } from "../lib/crops";
import type { MapData } from "../lib/map";
import type { PreviewMossling } from "../lib/map-preview";
import type { WorldResources } from "../lib/world-resources";

function world(patch: {
  crops?: { growth: number; moisture: number; light?: number }[];
  mosslings?: PreviewMossling[];
  resources?: Partial<WorldResources>;
  events?: { id: number; message: string }[];
}): AdvisoryWorld {
  const crops = patch.crops ?? [{ growth: 1, moisture: 1 }];
  const mosslings = patch.mosslings ?? [
    { id: 1, cellIndex: 0, health: 100, colors: ["#ffe632"], pattern: 0 },
  ];
  const map: MapData = {
    width: crops.length,
    height: 1,
    seed: 1,
    cells: crops.map((crop) => ({
      terrain: "grass" as const,
      elevation: 0.6,
      moisture: crop.moisture,
      light: crop.light,
      rockiness: 0.2,
      fertility: 0.5,
      growth: crop.growth,
    })),
  };
  const living = mosslings.filter((mossling) => (mossling.health ?? 100) > 0);
  return {
    map,
    mosslings,
    events: patch.events ?? [],
    resources: {
      mosslings: living.length,
      killed: 0,
      food: crops.filter((crop) => crop.growth >= 1).length,
      trees: 0,
      destroyed: 0,
      born: 0,
      health: living.length
        ? Math.round(
            living.reduce(
              (sum, mossling) => sum + (mossling.health ?? 100),
              0,
            ) / living.length,
          )
        : 0,
      ...patch.resources,
    },
  };
}

function show(
  current: AdvisoryWorld,
  memory: AdvisoryMemory = EMPTY_ADVISORY_MEMORY,
  now = 0,
  commit = true,
) {
  return stepAdvisory(current, memory, now, commit);
}

test("a healthy opening does not interrupt the board", () => {
  const step = show(world({}));
  assert.equal(step.kind, null);
});

test("starvation is the first warning", () => {
  const step = show(
    world({
      events: [{ id: 1, message: "1 Mossling starved." }],
      mosslings: [
        {
          id: 1,
          cellIndex: 0,
          health: 40,
          hungry: true,
          colors: ["#ffe632"],
          pattern: 0,
        },
      ],
      crops: [
        { growth: 1, moisture: 0.1 },
        { growth: 1, moisture: 0.1 },
      ],
      resources: { food: 0, health: 40 },
    }),
  );
  assert.equal(step.kind, "starve");
});

test("withering crops outrank a dry field", () => {
  const step = show(
    world({
      events: [{ id: 1, message: "The carrots withered on 2 tiles." }],
      crops: [
        { growth: 1, moisture: 0.2 },
        { growth: 1, moisture: 0.2 },
      ],
    }),
  );
  assert.equal(step.kind, "wither");
});

test("a field that is at least half below growing moisture asks for rain", () => {
  const dry = show(
    world({
      crops: [
        { growth: 1, moisture: CROP_GROW_MOISTURE - 0.01 },
        { growth: 0.5, moisture: 1 },
      ],
    }),
  );
  assert.equal(dry.kind, "dry");
  const damp = show(
    world({
      crops: [
        { growth: 1, moisture: CROP_GROW_MOISTURE - 0.01 },
        { growth: 1, moisture: 1 },
        { growth: 1, moisture: 1 },
      ],
    }),
  );
  assert.equal(damp.kind, null);
});

test("a moist dark field asks for sun, and a dry field still asks for rain first", () => {
  const shaded = show(
    world({
      crops: [
        { growth: 0.5, moisture: 1, light: 0 },
        { growth: 0.2, moisture: 1 },
      ],
    }),
  );
  assert.equal(shaded.kind, "shade");
  const lit = show(
    world({
      mosslings: [],
      crops: [
        { growth: 0.5, moisture: 1, light: 1 },
        { growth: 0.2, moisture: 1, light: 1 },
      ],
    }),
  );
  assert.equal(lit.kind, null);
  const dry = show(
    world({
      crops: [
        { growth: 0.5, moisture: 0.1 },
        { growth: 0.2, moisture: 1 },
      ],
    }),
  );
  assert.equal(dry.kind, "dry");
});

test("small health drops above the advisory threshold stay quiet", () => {
  const fed = world({
    mosslings: [
      { id: 1, cellIndex: 0, health: 100, colors: ["#ffe632"], pattern: 0 },
    ],
  });
  const opened = show(fed);
  const hungry = world({
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health: 98,
        hungry: true,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health: 98 },
  });
  assert.equal(show(hungry, opened.memory, 1).kind, null);
  assert.ok(98 > HEALTH_ADVISORY_BELOW);
});

test("falling health warns only while Mosslings are hungry", () => {
  const fed = world({
    mosslings: [
      { id: 1, cellIndex: 0, health: 100, colors: ["#ffe632"], pattern: 0 },
    ],
  });
  const opened = show(fed);
  assert.equal(opened.kind, null);
  const hungry = world({
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health: 70,
        hungry: true,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health: 70 },
  });
  assert.equal(show(hungry, opened.memory, 1).kind, "health");
  const hurt = world({
    mosslings: [
      { id: 1, cellIndex: 0, health: 70, colors: ["#ffe632"], pattern: 0 },
    ],
    resources: { health: 70 },
  });
  assert.equal(show(hurt, opened.memory, 1).kind, null);
});

test("too few ripe tiles asks for more crops", () => {
  const step = show(
    world({
      crops: [{ growth: 1, moisture: 1 }],
      mosslings: [
        { id: 1, cellIndex: 0, health: 100, colors: ["#ffe632"], pattern: 0 },
        { id: 2, cellIndex: 1, health: 100, colors: ["#ffe632"], pattern: 0 },
      ],
      resources: { food: 1, mosslings: 2 },
    }),
  );
  assert.equal(step.kind, "shortage");
});

test("the same warning waits, then repeats while the trouble continues", () => {
  const current = world({
    events: [{ id: 1, message: "2 Mosslings starved." }],
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health: 20,
        hungry: true,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health: 20, food: 0 },
  });
  const first = show(current);
  assert.equal(first.kind, "starve");
  const held = show(current, first.memory, 1_000);
  assert.equal(held.kind, null);
  const again = show(current, held.memory, ADVISORY_REPEAT_MS);
  assert.equal(again.kind, "starve");
});

test("a warning that cleared shows again as soon as it returns", () => {
  const starving = world({
    events: [{ id: 1, message: "1 Mossling starved." }],
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health: 30,
        hungry: true,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health: 30 },
  });
  const first = show(starving);
  assert.equal(first.kind, "starve");
  const fed = world({
    events: [{ id: 1, message: "1 Mossling starved." }],
    mosslings: [
      { id: 1, cellIndex: 0, health: 60, colors: ["#ffe632"], pattern: 0 },
    ],
    resources: { health: 60 },
  });
  const recovered = show(fed, first.memory, 1_000);
  assert.equal(recovered.kind, null);
  const returned = show(
    world({
      events: [
        { id: 2, message: "1 Mossling starved." },
        { id: 1, message: "1 Mossling starved." },
      ],
      mosslings: [
        {
          id: 1,
          cellIndex: 0,
          health: 60,
          hungry: true,
          colors: ["#ffe632"],
          pattern: 0,
        },
      ],
      resources: { health: 60 },
    }),
    recovered.memory,
    2_000,
  );
  assert.equal(returned.kind, "starve");
});

test("health stays on cooldown between months until it recovers", () => {
  const opened = show(world({}));
  const weakened = world({
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health: 70,
        hungry: true,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health: 70 },
  });
  const dropped = show(weakened, opened.memory, 1);
  assert.equal(dropped.kind, "health");
  const between = show(weakened, dropped.memory, 2);
  assert.equal(between.kind, null);
  const lower = world({
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health: 60,
        hungry: true,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health: 60 },
  });
  assert.equal(
    show(lower, between.memory, ADVISORY_REPEAT_MS + 1).kind,
    "health",
  );
});

test("a held warning is not put on cooldown until it is shown", () => {
  const current = world({
    crops: [
      { growth: 1, moisture: 0.2 },
      { growth: 1, moisture: 0.2 },
    ],
  });
  const held = show(current, EMPTY_ADVISORY_MEMORY, 0, false);
  assert.equal(held.kind, "dry");
  const shown = show(current, held.memory, 1, true);
  assert.equal(shown.kind, "dry");
  assert.equal(show(current, shown.memory, 2).kind, null);
});

test("falling health outranks a food shortage", () => {
  const shortage = show(
    world({
      crops: [{ growth: 1, moisture: 1 }],
      resources: { food: 0, mosslings: 2 },
      mosslings: [
        { id: 1, cellIndex: 0, health: 90, colors: ["#ffe632"], pattern: 0 },
        { id: 2, cellIndex: 1, health: 90, colors: ["#ffe632"], pattern: 0 },
      ],
    }),
  );
  assert.equal(shortage.kind, "shortage");
  const withHealth = show(
    world({
      crops: [{ growth: 1, moisture: 1 }],
      resources: { food: 0, mosslings: 1, health: 70 },
      mosslings: [
        {
          id: 1,
          cellIndex: 0,
          health: 70,
          hungry: true,
          colors: ["#ffe632"],
          pattern: 0,
        },
      ],
    }),
    { ...EMPTY_ADVISORY_MEMORY, previousHealth: 90, healthFalling: true },
  );
  assert.equal(withHealth.kind, "health");
});

function livingAt(health: number, extra?: { hungry?: boolean }) {
  return world({
    mosslings: [
      {
        id: 1,
        cellIndex: 0,
        health,
        hungry: extra?.hungry,
        colors: ["#ffe632"],
        pattern: 0,
      },
    ],
    resources: { health },
  });
}

test("opening health of 100 stays quiet", () => {
  assert.equal(show(livingAt(100)).kind, null);
});

test("crossing below 40 fires approvalLow once", () => {
  const opened = show(livingAt(100));
  const dropped = show(livingAt(APPROVAL_LOW_BELOW - 1), opened.memory, 1);
  assert.equal(dropped.kind, "approvalLow");
  assert.equal(
    show(livingAt(APPROVAL_LOW_BELOW - 1), dropped.memory, 2).kind,
    null,
  );
});

test("health that only meets 40 does not fire the approval story", () => {
  const opened = show(livingAt(100));
  assert.equal(show(livingAt(APPROVAL_LOW_BELOW), opened.memory, 1).kind, null);
});

test("recovering over 80 after a crisis fires approvalHigh once", () => {
  const opened = show(livingAt(100));
  const dropped = show(livingAt(35), opened.memory, 1);
  assert.equal(dropped.kind, "approvalLow");
  const held = show(livingAt(35), dropped.memory, 2);
  const recovered = show(livingAt(APPROVAL_HIGH_ABOVE + 1), held.memory, 3);
  assert.equal(recovered.kind, "approvalHigh");
  assert.equal(
    show(livingAt(APPROVAL_HIGH_ABOVE + 1), recovered.memory, 4).kind,
    null,
  );
});

test("health that never fell below 40 does not praise a climb past 80", () => {
  const opened = show(livingAt(70));
  assert.equal(opened.kind, null);
  assert.equal(show(livingAt(85), opened.memory, 1).kind, null);
});

test("a world that opens already below 40 still praises a climb past 80", () => {
  const opened = show(livingAt(35));
  assert.equal(opened.kind, null);
  assert.equal(show(livingAt(85), opened.memory, 1).kind, "approvalHigh");
});

test("a held approval story waits until it can show", () => {
  const opened = show(livingAt(100));
  const held = show(livingAt(35), opened.memory, 1, false);
  assert.equal(held.kind, "approvalLow");
  assert.equal(held.memory.pendingApprovalLow, true);
  const shown = show(livingAt(35), held.memory, 2, true);
  assert.equal(shown.kind, "approvalLow");
  assert.equal(shown.memory.pendingApprovalLow, false);
  assert.equal(show(livingAt(35), shown.memory, 3).kind, null);
});

test("declining approval outranks the falling-health warning", () => {
  const opened = show(livingAt(100));
  const dropped = show(livingAt(35, { hungry: true }), opened.memory, 1);
  assert.equal(dropped.kind, "approvalLow");
});

test("an empty world does not flash approval as Mosslings die out", () => {
  const opened = show(livingAt(100));
  const empty = world({
    mosslings: [],
    resources: { health: 0, mosslings: 0 },
  });
  assert.equal(show(empty, opened.memory, 1).kind, null);
});
