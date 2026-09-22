import type { MapCell } from "@/lib/map";
import { type SeasonLook, SUMMER_LOOK } from "@/lib/map-preview";
import { brownBlend, mixHex } from "@/lib/vegetation";

const portraits = {
  tree: [
    "................",
    ".....hlll.......",
    "...hlggggll.....",
    "..hlgGggggGl....",
    ".hlgGggggggGl...",
    ".hlggggggggggl..",
    "..hlgGgggggGl...",
    "...hlggggll.....",
    "......tttt......",
    "......tTTt......",
    "......tTTt......",
    "......tTTt......",
    "....dddddddd....",
    "...ddggggggdd...",
    "..dddddddddddd..",
    ".dddddddddddddd.",
  ],
  treeHurt: [
    "................",
    ".....ll.........",
    "...llg..h.......",
    "..lgG....l......",
    ".l.g......l.....",
    ".lg...gg..gl....",
    "..l..gG..l......",
    "...l.gl.........",
    "......tTTt......",
    "......tTTt......",
    "......tTT.......",
    "......tT........",
    "....dddddddd....",
    "...dddddddddd...",
    "..dddddddddddd..",
    ".dddddddddddddd.",
  ],
  grass: [
    "................",
    "...l.....l..l...",
    "..lll...lll.ll..",
    ".lllll.lllllll..",
    "..lll...lll.ll..",
    "...l..l..l...l..",
    ".lll.lll....lll.",
    "lllllll.l..lllll",
    ".lllll.lll.llll.",
    "...l.....l..l...",
    "dddddddddddddddd",
    "DggDggDggDggDggD",
    "gggggggggggggggg",
    "................",
    "................",
    "................",
  ],
  dirt: [
    "................",
    "................",
    ".....eee........",
    "...eeddddee.....",
    "..edddddddde....",
    ".edddddddddde...",
    ".eddddddddddde..",
    "..edddddddddde..",
    "...edddddddde...",
    ".....eeeeee.....",
    ".rr.............",
    "rRrr............",
    ".rr......rr.....",
    "........rRr.....",
    ".........rr.....",
    "................",
  ],
  rock: [
    "................",
    "......ppp.......",
    "....ppprrp......",
    "...ppprrrrp.....",
    "..ppprrrrrrp....",
    "..pprrrrrrrR....",
    "...prrrrrrRR....",
    "....prrrrRR.....",
    ".....ppppp......",
    "................",
    ".pp.............",
    "pprrp...........",
    "prrRp...........",
    ".ppp............",
    "................",
    "................",
  ],
  water: [
    "................",
    "................",
    "................",
    "...bbbbbbbbbb...",
    "..baaaWWWWWaab..",
    ".baaWWffWWWWaab.",
    ".bbaaWWWWWWWWab.",
    "..baaWWWffWWaab.",
    "...baaWWWWWaab..",
    "....bbbbbbbb....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  cropSown: [
    "................",
    "................",
    ".dddddddddddddd.",
    ".duuuduuuduuudu.",
    ".dddddddddddddd.",
    ".duuuduuuduuudu.",
    ".dddddddddddddd.",
    ".duuuduuuduuudu.",
    ".dddddddddddddd.",
    ".duuuduuuduuudu.",
    ".dddddddddddddd.",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  cropGrowing: [
    "................",
    "..l.l.l.l.l.l.l.",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "..l.l.l.l.l.l.l.",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "..y.y.y.y.y.y.y.",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "..y.y.y.y.y.y.y.",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "................",
    "................",
    "................",
  ],
  cropRipe: [
    "..Y.Y.Y.Y.Y.Y.Y.",
    ".YYY.YY.YY.YY.YY",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "..Y.Y.Y.Y.Y.Y.Y.",
    ".YYY.YY.YY.YY.YY",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "..Y.Y.Y.Y.Y.Y.Y.",
    ".YYY.YY.YY.YY.YY",
    "..c.c.c.c.c.c.c.",
    ".ddddddddddddddd",
    "................",
    "................",
    "................",
    "................",
  ],
  burned: [
    "................",
    "................",
    "................",
    "...AAAAAAAAAA...",
    "..ABBBBBBBBBBA..",
    ".ABBBBoBBBBBBBA.",
    ".ABBBBCCBBBBBBA.",
    "..ABBBBBBBBBBA..",
    "...AAAAAAAAAA...",
    ".dddddddddddddd.",
    "dddddddddddddddd",
    ".dddddddddddddd.",
    "................",
    "................",
    "................",
    "................",
  ],
  crater: [
    "................",
    "......ee........",
    "....eeeeee..e...",
    "..eeddddddddee..",
    ".edddCCCCCCddde.",
    ".eddCC....CCdde.",
    ".edC........Cde.",
    ".edC........Cde.",
    ".eddCC....CCdde.",
    ".edddCCCCCCddde.",
    "..eeddddddddee..",
    "....eeeeeeee....",
    ".........ee.....",
    "................",
    "................",
    "................",
  ],
  cracked: [
    "................",
    ".dddddddddddddd.",
    ".dddkdddddddkdd.",
    ".ddddkdddddkddd.",
    ".dddddkdddkdddd.",
    ".ddddddkdkddddd.",
    ".dddddddkdddddd.",
    ".dddkddddkddddd.",
    ".dddkdddddkdddd.",
    ".ddddddddddkddd.",
    ".dddddddddddddd.",
    ".ddkddddddddddd.",
    ".dddddddddddddd.",
    "................",
    "................",
    "................",
  ],
  fire: [
    "................",
    ".......z........",
    "......zzz.......",
    ".....ozzzo......",
    "....oozzzoo.....",
    "...Fooozzoo.....",
    "..FFFoooooo.....",
    ".FFFoooooooo....",
    ".FFFooooooooo...",
    "..FFFoooooo.....",
    "...FFFFooo......",
    "....FFFFF.......",
    "...dddddddd.....",
    "..dddddddddd....",
    ".dddddddddddd...",
    "................",
  ],
} as const;

const palette: Record<string, string> = {
  h: "#c6ee7a",
  l: "#78be42",
  g: "#3d9a34",
  G: "#1d6b2c",
  t: "#795030",
  T: "#4a3018",
  d: "#7a4e30",
  D: "#4a301c",
  e: "#c4a06a",
  r: "#6e7468",
  R: "#3a403c",
  p: "#c5cdc2",
  b: "#3a8ec4",
  a: "#1a6a9e",
  W: "#0d3f68",
  f: "#d4f0ff",
  u: "#5a3818",
  c: "#2f5a22",
  y: "#8fce4a",
  Y: "#e4ef7a",
  A: "#6b5644",
  B: "#2c241c",
  C: "#12100e",
  F: "#e54320",
  o: "#ff941b",
  z: "#ffe128",
  k: "#1c1814",
};

const backdrop: Record<PortraitName, string> = {
  tree: "#102416",
  treeHurt: "#102416",
  grass: "#102416",
  dirt: "#1c140e",
  rock: "#161a18",
  water: "#071e30",
  cropSown: "#1a140e",
  cropGrowing: "#1a140e",
  cropRipe: "#1a140e",
  burned: "#140e0c",
  crater: "#241810",
  cracked: "#1a140e",
  fire: "#1a0c08",
};

type PortraitName = keyof typeof portraits;

function portraitFor(cell: MapCell): { name: PortraitName; label: string } {
  if (cell.burning) return { name: "fire", label: "Pixel-art picture of fire" };
  if (cell.tree) {
    return cell.tree.health < 40
      ? { name: "treeHurt", label: "Pixel-art picture of a damaged tree" }
      : { name: "tree", label: "Pixel-art picture of a tree" };
  }
  if (cell.growth !== undefined) {
    if (cell.growth >= 5 / 6)
      return { name: "cropRipe", label: "Pixel-art picture of ripe crops" };
    if (cell.growth < 1 / 6)
      return { name: "cropSown", label: "Pixel-art picture of a sown field" };
    return {
      name: "cropGrowing",
      label: "Pixel-art picture of growing crops",
    };
  }
  if (cell.damage === "crater" && (cell.recovery ?? 0) < 0.55)
    return { name: "crater", label: "Pixel-art picture of a crater" };
  if (cell.damage === "burned" && (cell.recovery ?? 0) < 0.55)
    return { name: "burned", label: "Pixel-art picture of scorched ground" };
  if (cell.damage === "cracked")
    return { name: "cracked", label: "Pixel-art picture of cracked ground" };
  switch (cell.terrain) {
    case "water":
      return { name: "water", label: "Pixel-art picture of water" };
    case "rock":
      return { name: "rock", label: "Pixel-art picture of rock" };
    case "dirt":
      return { name: "dirt", label: "Pixel-art picture of dirt" };
    case "grass":
      return { name: "grass", label: "Pixel-art picture of grass and moss" };
  }
}

const dryGreens: Record<string, string> = {
  h: "#e4d090",
  l: "#c4a05a",
  g: "#8a5a2c",
  G: "#5c4030",
};

const autumnLeaves: Record<string, string> = {
  h: "#f2c14a",
  l: "#e87820",
  g: "#c44818",
  G: "#8a3a14",
};

const bareLeaves: Record<string, string> = {
  h: "#b08968",
  l: "#8a6244",
  g: "#6b4630",
  G: "#4a3424",
};

const LEAF = new Set(["h", "l", "g", "G"]);

const iceWater: Record<string, string> = {
  b: "#d7eaf3",
  a: "#b9d6e6",
  W: "#8eb6cc",
  f: "#f7fbff",
};

function leafFill(letter: string, drought: number, look: SeasonLook): string {
  const lush = palette[letter];
  const dry = dryGreens[letter]
    ? mixHex(lush, dryGreens[letter], drought)
    : lush;
  const turned = autumnLeaves[letter]
    ? mixHex(dry, autumnLeaves[letter], look.autumn)
    : dry;
  return bareLeaves[letter]
    ? mixHex(turned, bareLeaves[letter], 1 - look.cover)
    : turned;
}

export function TilePortrait({
  cell,
  look = SUMMER_LOOK,
  snow = look.snow,
  ice = look.ice,
  buried = false,
}: {
  cell: MapCell;
  look?: SeasonLook;
  /** Local drift depth, already thinned by elevation and shore. */
  snow?: number;
  /** How frozen this water tile is, from open water to a white-blue sheet. */
  ice?: number;
  /** The whole tile is one of the solid winter drifts. */
  buried?: boolean;
}) {
  const { name, label } = portraitFor(cell);
  if (buried) {
    return (
      <svg
        className="terrain-portrait"
        viewBox="0 0 16 16"
        role="img"
        aria-label={label}
        shapeRendering="crispEdges"
      >
        <rect width="16" height="16" fill="#ffffff" />
      </svg>
    );
  }
  const living = name === "tree" || name === "treeHurt" || name === "grass";
  const amount = living ? brownBlend(cell.moisture) : 0;
  const pixels = portraits[name].flatMap((row, y) =>
    [...row].flatMap((color, x) => {
      if (color === ".") return [];
      if (
        living &&
        LEAF.has(color) &&
        look.cover < 0.98 &&
        (x * 5 + y * 3 + 7) % 100 >= Math.round(look.cover * 100)
      )
        return [];
      return [{ id: `${x}-${y}`, x, y, color }];
    }),
  );
  const ground = living
    ? mixHex(
        mixHex(backdrop[name], "#24180e", amount),
        "#3a2a1c",
        1 - look.cover,
      )
    : name === "water"
      ? mixHex(backdrop.water, "#d5e6f0", ice)
      : backdrop[name];
  const flakes =
    snow >= 0.045 && name !== "water" && name !== "fire"
      ? Array.from(
          { length: Math.min(8, Math.max(1, Math.round(snow * 16))) },
          (_, i) => ({
            id: `snow-${i}`,
            x: 3 + (i % 3) * 2 + (i % 2),
            y: 9 + Math.floor(i / 3),
          }),
        )
      : [];
  return (
    <svg
      className="terrain-portrait"
      viewBox="0 0 16 16"
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width="16" height="16" fill={ground} />
      {pixels.map((pixel) => (
        <rect
          key={pixel.id}
          x={pixel.x}
          y={pixel.y}
          width="1"
          height="1"
          fill={
            living && LEAF.has(pixel.color)
              ? leafFill(pixel.color, amount, look)
              : name === "water" && iceWater[pixel.color] && ice > 0
                ? (pixel.x * 3 + pixel.y) % 7 < Math.round(ice * 7) ||
                  ice > 0.85
                  ? mixHex(palette[pixel.color], iceWater[pixel.color], ice)
                  : palette[pixel.color]
                : palette[pixel.color]
          }
        />
      ))}
      {flakes.map((flake) => (
        <rect
          key={flake.id}
          x={flake.x}
          y={flake.y}
          width="1"
          height="1"
          fill="#f4f8fb"
        />
      ))}
    </svg>
  );
}
