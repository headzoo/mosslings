Mosslings — Desktop Codex Handoff

Purpose

This document captures the current direction for the One Screen hackathon project so development can continue in Desktop Codex without re-deriving the design decisions from the full conversation.

The core idea is a single-screen god/evolution simulation about a swarm of tiny creatures called Mosslings. The important contrast is:

Promotional/lore art: Mosslings are cute, fuzzy little moss balls with visible pattern variation.

Actual game rendering: there are no character sprites. Each Mossling is just one 8×8 pixel cell whose internal pixel colors/patterns are generated from its inherited genome.

The simulation should be richer than the graphics. The player watches a population grow, reproduce, mutate, diverge, survive disasters, and evolve over real family trees while interacting with the world through god powers.

1. Hackathon constraint

Theme: One Screen.

The entire experience lives in a single persistent view:

no routes

no navigation to a second page

no separate character screen

no separate tech tree

no separate family-tree page

Panels/inspectors may open inside the same view, but the map should remain the primary visual at all times.

2. Current name and fiction

Name

Mosslings

We briefly explored slime-mold names such as Goopies/Glooplings, but the current decision is to return to Mosslings.

Creature personality

Mosslings are:

slow

peaceful

surprisingly resilient

extremely unintelligent

individually genetically unique

more interesting as a swarm than as traditional game characters

Their stupidity should be part of the charm. They should make simplistic or questionable decisions while still being capable of evolving highly effective survival traits.

The game should avoid turning them into little human villagers with detailed occupations, clothing, animations, etc.

3. Visual identity: promotional art vs. game graphics

Promotional / poster art

In illustrations, Mosslings are fuzzy spherical moss creatures with little faces. Their inherited differences are visible as natural moss coloration and patterns:

stripes

spots

rings

mottled patches

half-and-half coloration

speckles

gradients

patchwork

The updated poster direction is fuzzier, more like living moss balls, and less like humanoid mascots.

Reference:

references/03-fuzzy-mosslings-concept.png

references/04-pattern-inheritance-concept.png

In-game rendering

Do not build sprites for:

Mosslings

houses

trees

rocks

plants

fire

tornadoes

terrain props

The entire board is intentionally abstract and generated from colored square cells.

The approved visual direction is a straight-down grid, not a 2/3 or isometric view.

Reference progression:

references/01-approved-baseline-map.png — approved general board layout / UI direction

references/02-patterned-mosslings-map.png — updated concept showing patterned 8×8 Mosslings

4. Board rendering model

Fundamental unit

Each logical map tile renders as exactly 8×8 screen pixels.

Terrain tiles are almost always a single solid color inside the 8×8 square.

Examples:

grass / moss: green

dense vegetation: dark green

new growth: lighter green

dirt: brown

dry dirt: tan

shallow water: blue

deep water: darker blue

stone: gray

burned terrain: charcoal/dark brown

active fire: orange/red/yellow cells

Terrain variation should come from the arrangement of cells, not from sprite artwork.

Mossling tile

A Mossling occupies a grid cell, but unlike terrain, its 8×8 pixels can each be independently colored.

This 8×8 block is the Mossling's visible phenotype / genetic fingerprint.

From far away, the player sees a moving swarm of tiny patterned squares.

At close inspection, family resemblance and mutations should become visible through shared patterns and colors.

5. Procedural world generation

The world should feel like a patch of ground rather than an entire planet.

Conceptually: imagine kneeling in the woods and looking closely at a small patch of soil where a microscopic civilization is growing.

The generated board can include:

irregular land masses

streams

ponds

dirt zones

moss/grass zones

stone clusters

burned regions

resource-rich regions

Avoid elaborate scenery. The visual richness should come from cellular patterns.

Suggested generation approach:

Generate broad terrain fields using noise or cellular automata.

Carve one or more water channels with random walks / spline-like paths mapped to cells.

Apply thresholds to produce grass, dirt, rock, and water regions.

Run smoothing passes so regions form coherent blobs rather than static noise.

Seed resources and starting Mosslings only in valid land cells.

Everything should be deterministic when given a seed if practical.

6. Mosslings are individual organisms, not population stats

This is a major design decision.

Do not model evolution primarily as:

Population Heat Resistance = 72

Instead, every Mossling should be an actual simulated organism with its own:

ID

parents

children

generation

birth time

age

health

hunger / energy

genome

phenotype

current behavior/state

position

possibly mate / reproductive state

Population-level numbers can be derived for charts or summaries, but the underlying system should always be individual-based.

7. Real inheritance and family trees

Each Mossling should have real parentage.

Suggested minimal model:

type Mossling = {
  id: number
  parentA?: number
  parentB?: number
  generation: number
  birthTick: number
  age: number
  x: number
  y: number
  health: number
  energy: number
  genome: Genome
  state: MosslingState
}

Children inherit genes from their parents rather than receiving a random new trait set.

The game should retain enough ancestry data to reconstruct:

parents

grandparents

children

descendants

founder ancestry

family branches

The user should eventually be able to click a Mossling and see a compact family-tree inspector without leaving the game screen.

8. Genetic traits

A practical first-pass set of functional genes:

Behavior

fear / cowardice

curiosity

sociability

aggression (optional; could stay very low species-wide)

food-seeking drive

mate selectivity

Physical / survival

movement speed

heat tolerance

water tolerance

toughness

metabolism

lifespan

Reproduction

fertility

maturity age

reproductive interval

litter size / chance of multiple offspring

The exact list can be trimmed for the MVP, but fear, curiosity, speed, heat tolerance, water tolerance, metabolism, toughness, lifespan, sociability, reproduction, and food behavior were explicitly discussed and should be represented unless scope forces cuts.

9. Genes should drive behavior

Avoid assigning canned personality classes such as:

behavior = "explorer"

Instead, behavior should emerge from inherited values.

Example:

Curiosity = 0.91
Fear      = 0.18
Speed     = 0.62

This Mossling is likely to wander farther from the swarm and investigate unknown terrain.

Another:

Curiosity = 0.23
Fear      = 0.86
Speed     = 0.48

This Mossling should remain near safe/populated areas and flee threats quickly.

The behavior system can remain simple. A utility-score model is enough:

score(food)     = hunger * foodDrive
score(explore)  = curiosity * safetyFactor
score(flee)     = perceivedThreat * fear
score(social)   = loneliness * sociability
score(rest)     = fatigue

Choose the highest-scoring behavior, apply noise, then move accordingly.

The goal is for inherited traits to visibly matter over generations.

10. Mutation and evolution

Evolution should happen because individuals reproduce differently under environmental pressure.

The player does not click an "evolve fire resistance" upgrade.

Instead:

fire kills vulnerable Mosslings

heat-tolerant Mosslings survive more often

survivors reproduce

their descendants inherit heat tolerance

Most mutations should be small numerical changes.

Occasionally there can be a large/rare mutation that creates a noticeable jump.

Examples:

major increase in heat tolerance

major water adaptation

unusual speed

unusually long lifespan

behavioral shift

new special allele

A rare mutation belongs to the individual where it first occurs. It only becomes common if that Mossling reproduces successfully.

That means a useful mutation can disappear forever if its first carrier dies.

This is desirable.

11. Genetic diversity and lineage effects

Desired emergent outcomes:

Founder effects

Start with a small founder population. Hundreds of generations later, all Mosslings trace back to these founders.

Population bottlenecks

A fire/tornado/meteor could reduce 1,000 Mosslings to 30 survivors. Their genomes then dominate the future population.

Geographic isolation

A river or disaster may split the population. Separate groups can diverge genetically.

Family resemblance

Relatives should often look similar because pattern genes are inherited.

Optional later feature: inbreeding

If feasible, genetic similarity between mates could increase harmful recessive expression. This is not required for the MVP, but the ancestry system should not make it impossible later.

12. 8×8 Mossling appearance system

This is a major visual mechanic.

Do not use a static layout such as "fear is always pixel (1,1)".

Instead, genes determine both:

trait strength / phenotype

how traits are arranged across the 8×8 body

The visual pattern is therefore inherited.

Pattern genes

Suggested appearance genes:

pattern family

solid

vertical stripe

horizontal stripe

diagonal stripe

spots

speckles

ring

half-and-half vertical

half-and-half horizontal

checker / mottled

center patch

patchwork

symmetry

none

vertical

horizontal

approximate radial

patch size

pattern density

primary/secondary trait ordering

overlap / dominance rule

mutation-marker style

Trait-to-color families

The exact palette can change, but functional traits should map to recognizable color families so the player can learn to read Mosslings.

Possible starting mapping:

Trait

Color family

Fear / cowardice

Yellow

Curiosity

Purple

Speed

Red

Heat tolerance

Orange

Water tolerance

Cyan / blue

Metabolism

Green

Toughness

Brown / gray

Lifespan

Teal

Sociability

Pink

Reproduction

Lime

Food behavior

Olive

Rare mutation / special allele

White, black, neon, or unusual accent

Trait strength should affect saturation/brightness/intensity.

Example:

low fear = dull mustard

high fear = bright yellow

Visual priority

Do not try to show every gene equally. That will become visual noise.

A good first approach:

Rank traits by visual importance / expressed strength.

Show the top 3–5 traits clearly.

Generate a pattern using inherited pattern genes.

Let minor traits affect subtle pixels, outlines, or the inspector only.

Rare mutations can claim a few distinctive pixels.

Family resemblance

Because offspring inherit both functional and pattern genes, families naturally form recognizable visual lineages:

one family may be yellow/blue striped

another may have red speckles

another may be half green / half cream

another may show concentric rings

As natural selection changes the population, the visual appearance of the swarm should visibly change.

13. Suggested renderer algorithm

Conceptual pseudocode:

function renderMossling(m: Mossling, px: number, py: number) {
  const phenotype = expressGenome(m.genome)
  const traits = chooseVisibleTraits(phenotype, 3, 5)
  const pattern = buildPatternMask(m.genome.appearance, traits)

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const trait = pattern[y][x]
      const color = traitColor(trait, phenotype[trait])
      ctx.fillStyle = color
      ctx.fillRect(px + x, py + y, 1, 1)
    }
  }
}

Terrain remains much cheaper:

ctx.fillStyle = terrainColor[cell.terrain]
ctx.fillRect(cellX * 8, cellY * 8, 8, 8)

This asymmetry is intentional: terrain is abstract; Mosslings contain visual information.

14. Reproduction and inheritance model

Recommended MVP: diploid-ish inheritance without trying to simulate real molecular genetics.

Each functional gene can have two alleles:

type Allele = {
  value: number
  dominance?: number
  mutationFlags?: number
}

type Gene = {
  a: Allele
  b: Allele
}

At reproduction:

Child receives one allele from parent A.

Child receives one allele from parent B.

Apply low-probability mutation to each copied allele.

Appearance genes are inherited in the same manner.

Phenotype is calculated from the allele pair.

For numeric genes, expression can initially be simple:

phenotype = lerp(a.value, b.value, dominance)

or even an average until dominance is implemented.

The important requirement is that heredity is real and lineage-preserving, not that the biology is molecularly accurate.

15. Swarm behavior

Although every Mossling is an individual, the board should visually read as a swarm.

Desired scenes:

a food-rich patch causes Mosslings to converge

a fire causes them to scatter

a tornado bends their movement into a rotating flow field

water channels constrain migration

repeated travel gradually forms paths / settlement areas

isolated clusters behave like separate populations

Hundreds of moving 8×8 blocks are more important than seeing individual characters.

The simulation should support selecting one organism for inspection, but the default experience is watching population-scale motion.

16. God powers

The current god-power concept includes:

Rain

Grow

Trees / vegetation growth (name can change)

Fire

Tornado

Earthquake / Quake

Lightning

Meteor

These should interact directly with the cell grid.

Examples

Fire

occupies cells

spreads according to nearby terrain / dryness

destroys or transforms terrain

damages/kills Mosslings by heat tolerance

leaves burned cells behind

Tornado

represented as a cellular spiral / moving field, not a sprite

applies directional force to Mossling movement

can relocate/kill organisms

can alter terrain if desired

Rain

reduces fire risk

changes soil moisture

encourages growth

may flood low areas

Earthquake

affects toughness survival

may transform terrain / rock distribution

Meteor

high-impact event

creates a crater / destroyed area

useful for dramatic bottlenecks

God powers are not just toys; they create selection pressure.

17. UI layout

The approved mock direction uses:

Center

Large game board, straight-down grid.

Left rail

God powers.

Top bar

Possible values:

Mossling count

food

wood / biomass

stone

water

year

season

pause / speed controls

These resources are still provisional. Do not overbuild an economy before the evolutionary simulation works.

Right rail

Event log and optionally a small overview/minimap.

Example events:

A tornado has formed!

A fire has started in the west.

Mosslings are fleeing.

A rare mutation appeared.

Population dropped below 50.

Two populations have reconnected.

Mossling #1842 has 100 living descendants.

Inspector

Clicking one Mossling should open an inspector in the existing UI rather than navigating away.

Potential contents:

magnified 8×8 pattern

ID

age

generation

parents

children

living descendants

expressed traits

carried recessive alleles (optional)

mutations

A compact ancestry tree can appear in this panel.

18. Time

The game should have pause and multiple simulation speeds.

Suggested:

Pause

1×

4×

16× or similar

Evolution requires generations to pass quickly enough that the player can observe change during a hackathon demo.

Consider automatically slowing to normal speed during major events such as:

first mutation

large disaster

population crash

new lineage dominance

19. Technology recommendation

This was discussed as a browser-based implementation.

Recommended stack:

TypeScript

HTML Canvas for board rendering

React or plain DOM for HUD/panels

Canvas is preferable for the simulation because:

terrain rendering is just fillRect

Mossling rendering is at most 64 tiny pixel draws per visible organism

hundreds or thousands of agents are practical

disasters can be drawn procedurally

no sprite asset pipeline is needed

Avoid thousands of DOM elements for individual Mosslings.

20. Suggested code architecture

This is a recommendation, not a hard requirement.

src/
  simulation/
    World.ts
    Terrain.ts
    Mossling.ts
    Genome.ts
    Genetics.ts
    Reproduction.ts
    Behavior.ts
    Selection.ts
    Disasters.ts
    Events.ts

  rendering/
    CanvasRenderer.ts
    TerrainRenderer.ts
    MosslingRenderer.ts
    PatternGenerator.ts
    Palette.ts

  generation/
    WorldGenerator.ts
    Noise.ts
    WaterGenerator.ts

  ui/
    HUD.tsx
    GodPowers.tsx
    EventLog.tsx
    MosslingInspector.tsx

  game/
    GameLoop.ts
    GameState.ts

Keep the simulation independent of rendering. A Mossling genome should not know about Canvas APIs.

21. Simulation performance

Do not prematurely simulate molecular biology or complex pathfinding.

Prefer:

grid-based neighborhood queries

spatial buckets

local perception radius

simple utility behavior

low-frequency decision updates

higher-frequency movement interpolation if needed

Example:

simulation tick: 10–20 Hz

major behavior decision: every 0.5–2 seconds with random staggering

rendering: requestAnimationFrame

Mosslings can move between logical cells or have sub-cell positions; either is acceptable. If using sub-cell positions, their rendered 8×8 body can still snap visually to integer pixels.

22. What NOT to build

These ideas were explored and rejected or de-emphasized:

isometric / SimCity-style 2/3 camera

detailed character sprites

animated houses / village props

entire-world map

poster-quality art inside the actual simulation

humanoid Mosslings

direct player-selected evolution upgrades

population-wide trait sliders as the underlying genetics model

manual city building as the core gameplay

Do not spend hackathon time generating hundreds of art assets.

The visual abstraction is a feature, not a temporary compromise.

23. MVP build order

Recommended implementation order:

Phase 1 — board

Canvas

fixed 8×8 logical cell rendering

procedural grass/dirt/water/rock regions

pan/zoom if necessary

Phase 2 — swarm

spawn 50–100 Mosslings

basic movement

Mosslings use 8×8 patterned rendering

individual IDs / age / energy

Phase 3 — genetics

two-parent reproduction

inheritance

small mutations

family IDs / ancestry

functional phenotype values

Phase 4 — behavior

food seeking

exploration

fear/fleeing

social clustering

reproduction

Behavior should use genetic values.

Phase 5 — disasters

Implement at least:

fire

tornado

rain

If time remains:

earthquake

lightning

meteor

Phase 6 — inspection / story

click Mossling

magnified 8×8 fingerprint

trait values

parents / children

mutations

event log

Phase 7 — polish

speed controls

years/generations

population stats

event highlighting

better procedural terrain

screenshots / promotional poster integration

24. Demo story to optimize for

The demo should make the concept understandable in under a minute.

A strong sequence:

Start with a small population of Mosslings on a generated landscape.

Show that each 8×8 Mossling has a unique inherited pattern.

Click one to reveal parents / genome / traits.

Trigger a fire on one side of the board.

Trigger a tornado elsewhere.

Watch different Mosslings flee/survive based on their traits.

Fast-forward several generations.

Show that descendants of survivors now dominate and visually share inherited colors/patterns.

Inspect a new mutation and its family tree.

The punchline is:

The graphics are tiny, but every colored square is a real evolving organism with parents, descendants, inherited behavior, and mutations.

25. Core design principles

When making implementation decisions, prefer these in order:

Emergent simulation over detailed graphics.

Individual heredity over global upgrades.

One screen at all times.

Simple rendering, rich state.

Swarm readability over character animation.

Evolution caused by the environment, not selected from a menu.

Patterns/colors should carry meaningful genetic information.

Family history should be real, not generated flavor text.

The Mosslings remain cute, peaceful, and dumb.

Keep the hackathon scope buildable.

26. Reference files

references/01-approved-baseline-map.png

The first map mock that matched the desired direction: straight-down colored grid, simple terrain, Mosslings as tiny cells, fire on one side, tornado on the other.

references/02-patterned-mosslings-map.png

Updated map concept showing Mosslings as individually patterned multicolor squares. This is the closest visual reference for the actual game board.

references/03-fuzzy-mosslings-concept.png

Updated promotional-art direction: fuzzy moss balls with stripes, spots, splits, rings, etc.

references/04-pattern-inheritance-concept.png

Concept art emphasizing hereditary visual patterns and family resemblance. Use for lore/marketing inspiration, not literal in-game sprites.

27. Immediate next implementation decision

The first technical spike should answer this question:

Can we generate a convincing 8×8 Mossling from a genome, inherit its pattern through reproduction, and visually recognize a family resemblance after several generations?

Before building the full simulation, implement a small sandbox that:

creates two parent genomes

renders their 8×8 patterns

creates 20 offspring through inheritance + mutation

renders all offspring in a grid

lets us visually verify that children resemble their parents without being clones

If this works, the same renderer becomes the visual foundation for the entire game.