# God powers

Each module in `actions/` exports a `GodAction` implementing the contracts in
`types.ts`: create an effect, update its world interaction, draw it procedurally,
and optionally validate placement or clean up on expiration. All positions and
radii are in map tiles. Rendering never mutates simulation state.

`GodWorld` owns the played world, effect lifetimes, seeded randomness, collisions,
health, tree damage and the event log. The UI advances it to the shared game clock,
using steps of at most 50ms during active effects, publishes changed snapshots at
up to 10Hz, and draws effects on a separate canvas. Pause, speed and skipped years
apply to effects and ecology alike. Events retain the date they occurred, including
events within a skipped year.
There are at most 16 concurrent effects. Resizing changes the camera, not the map.
The world remains in memory for the page session; reloading creates a new world.

- Rain: 5-tile radius, 6 seconds; moisture, fertility and fire suppression.
- Sun: 5-tile radius, 4 seconds; fills light, cures the black death, and restores 30 health to the living. Crops ripen only while both moisture and light stay at or above 0.4. A full sun charge lasts about a year. Darkness stalls growth; drought still withers the crop.
- Crops: a connected stand of trees, or up to eight connected grass or dirt tiles, becomes crop land. A new planting starts fully watered. Fresh crop land shows as green, then ripens over six months that are both wet and lit. Winter pauses that clock. Fields do not grow, dry out, or wither, and ripe tiles do not count as food until spring. Planting in winter is allowed; those tiles wait.
- Trees: one empty grass/dirt tile; persistent tree with health.
- Fire: spreads at most 6 tiles from placement on wet ground, and out to 10 tiles through brown trees, grass, and moss. Burns out within 10 seconds.
- Tornado: 4-tile radius, wanders for 12 seconds; damage and collision-safe movement.
- Nuke: 0.7-second missile approach, then a 25-tile crater and a mushroom cloud that fades by 4 seconds.
- Lightning: immediate localized damage and scorching; a 0.9-second bolt.
- Meteor: 0.7-second approach, impact damage and a 6-tile crater; debris fades by 2.8 seconds.

The world also makes its own weather on the monthly clock. About twice a season a
light shower forms. In winter the same clouds drop snow; the moisture, fertility,
and flood rules do not change. About a third of those showers pick a crop tile when any
exist; the rest fall on a tree or on grass and moss. A shower lasts about 3
seconds at 0.4 intensity, so it cannot refill a field the way a 6-second god
rain can. Lightning
strikes under a rain cloud about one tenth of each second it is falling, for
god rain as well as wild showers. About
once every six years one of fire, tornado, nuke, lightning, or meteor starts
on its own. Disease stays a player power.

Rain on ground that is already soaked builds flood pressure and fades when the
cloud leaves. One god cloud stays under the line. Three overlapping god clouds,
or repeated rain before the pressure fades, turn grass, dirt, rock, and trees
into lasting water. Ecology does not grow that ground back. About once every
twenty years a storm floods a 4-tile patch outright and hangs rain clouds over
it. If all 16 effect slots are full, that storm waits for a later month. Other
wild weather skips the month instead of blocking a god cast.

Mossling toughness and heat/water tolerance reuse the inspector's stable preview
traits. Health reaches zero on death, removing the organism from the world and
population count. Once per month (4 game seconds), each living Mossling attempts
one randomly chosen open orthogonal neighbor, without consulting traits. It waits
if blocked. Water, rock, trees, fire, other Mosslings, and regrowing tree footprints
are excluded. Skipping processes every intervening month. Ordinary wandering is
suspended while panicked, so monthly ticks cannot pull a fleeing Mossling back
toward danger.

`avoidance.ts` handles disaster flight on the same game clock as the hazards.
Each destructive action exposes its current threat footprint: actual burning
cells, the moving tornado, the approaching meteor and nuke impact areas, and
the brief lightning flash. Rain and building powers do not trigger panic.
Lightning still hits immediately; survivors react afterward. Meteors and nukes
have a short approach period during which flight is possible.

The inspector's stable genetic traits drive the response:
- Speed sets running pace (1.5–6 tiles per game second at trait extremes).
- Courage/cowardice set alert thresholds, sensing distance and reaction delay.
- Heat tolerance and toughness reduce perceived danger as well as actual damage.
- Sociability spreads local alarm and biases movement toward nearby fleeing
  neighbors' direction and group, within four tiles. Signals are sampled before
  movement; they cannot propagate instantly across the entire population.

Escape routing searches up to four tiles ahead around obstacles, then moves only
one adjacent tile. It evaluates overlapping hazards before herd alignment and
never uses traits to bypass impassable tiles or occupancy. Equal choices are
deterministic, and turn order rotates to reduce crowd bias. Panic fades after
danger passes, even after the final effect disappears. A small amber `!` and the
inspector show panic. Flight is an attempt, not immunity: blocked paths, late
reactions, and impact damage can still kill. All motion follows pause, speed and
skip; no health or population is restored by avoidance.

`ecology.ts` preserves each damaged tile's pre-catastrophe state. Soil and surviving
trees recover monthly, scars fade, and destroyed trees/terrain are restored on the
first monthly tick at least two years (96 game seconds) after the last damage.
Repeated damage restarts the timer without losing the original target. Dead
Mosslings never return. Crops replaces pending recovery on the tiles it edits.
Forest edges spread into adjacent free grass or
dirt once every two years, and only from a tree whose moisture is at least 0.7.
Dry trees keep that turn until they are watered. New trees wait a full two
years before spreading again, and only if their own ground is well watered.
Trees, grass, and moss lose moisture each month unless they are within four
tiles of water. A full soaking lasts about ten years on a tree and about five
years on grass and moss before the tile turns brown. Crops still wilt on their
own five-year clock, and winter months do not count toward it. Water within that belt holds moisture up to a green floor,
short of the saturation that starts a flood.

The toolbar shows available world resources, not an inventory: living Mosslings,
ripe crop tiles (food), living tree tiles (trees),
undamaged rock tiles (stone), and water tiles. Food is zero through winter, while
the fields themselves stay put. Each month the fields fall short of what the
living Mosslings need, health drops. Below a quarter of a ripe tile per Mossling,
the hungriest die, except in winter, when only the health loss applies. A
Mossling at full health can last the three winter months. Enough food lets
health climb back.

To run focused checks without adding a test dependency:

```sh
pnpm exec tsc tests/god-actions.test.ts tests/world-time.test.ts tests/game-time.test.ts tests/disaster-avoidance.test.ts tests/weather.test.ts tests/vegetation.test.ts tests/crops.test.ts --outDir /tmp/mosslings-god-tests --module commonjs --target es2020 --esModuleInterop --skipLibCheck
node /tmp/mosslings-god-tests/tests/god-actions.test.js
node /tmp/mosslings-god-tests/tests/world-time.test.js
node /tmp/mosslings-god-tests/tests/game-time.test.js
node /tmp/mosslings-god-tests/tests/disaster-avoidance.test.js
node /tmp/mosslings-god-tests/tests/weather.test.js
node /tmp/mosslings-god-tests/tests/vegetation.test.js
node /tmp/mosslings-god-tests/tests/crops.test.js
```
