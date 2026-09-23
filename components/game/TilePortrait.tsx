import type { MapCell } from "@/lib/map";
import { type SeasonLook, SUMMER_LOOK } from "@/lib/map-preview";

type PortraitName =
  | "tree"
  | "treeHurt"
  | "grass"
  | "dirt"
  | "sand"
  | "rock"
  | "water"
  | "cropSown"
  | "cropGrowing"
  | "cropRipe"
  | "burned"
  | "crater"
  | "cracked"
  | "fire";

const FILE: Record<PortraitName, string> = {
  tree: "tree",
  treeHurt: "tree-hurt",
  grass: "grass",
  dirt: "dirt",
  sand: "sand",
  rock: "rock",
  water: "water",
  cropSown: "crop-sown",
  cropGrowing: "crop-growing",
  cropRipe: "crop-ripe",
  burned: "burned",
  crater: "crater",
  cracked: "cracked",
  fire: "fire",
};

function portraitFor(
  cell: MapCell,
  look: SeasonLook,
): { name: PortraitName; label: string } {
  if (cell.burning) return { name: "fire", label: "Pixel-art picture of fire" };
  if (cell.tree) {
    return cell.tree.health < 40
      ? { name: "treeHurt", label: "Pixel-art picture of a damaged tree" }
      : { name: "tree", label: "Pixel-art picture of a tree" };
  }
  if (cell.growth !== undefined) {
    const growth = (cell.growth ?? 0) * look.crop;
    if (cell.blight && (cell.growth ?? 0) >= 1)
      return { name: "cropRipe", label: "Pixel-art picture of dead carrots" };
    if (growth >= 5 / 6)
      return { name: "cropRipe", label: "Pixel-art picture of ripe carrots" };
    if (growth < 1 / 6)
      return { name: "cropSown", label: "Pixel-art picture of sown carrots" };
    return {
      name: "cropGrowing",
      label: "Pixel-art picture of growing carrots",
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
    case "sand":
      return { name: "sand", label: "Pixel-art picture of sand" };
    case "grass":
      return { name: "grass", label: "Pixel-art picture of grass and moss" };
  }
}

function portraitFile(
  name: PortraitName,
  look: SeasonLook,
  ice: number,
): string {
  if ((name === "cropGrowing" || name === "cropRipe") && look.crop < 0.35)
    return "crop-sown";
  if (name === "water") return ice > 0.5 ? "water-ice" : "water";
  const base = FILE[name];
  if (name === "tree" || name === "treeHurt" || name === "grass") {
    if (look.cover < 0.35) return `${base}-winter`;
    if (look.autumn > 0.45) return `${base}-autumn`;
  }
  return base;
}

export function TilePortrait({
  cell,
  look = SUMMER_LOOK,
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
  const { name, label } = portraitFor(cell, look);
  const file = buried ? "snow" : portraitFile(name, look, ice);
  return (
    // Pixel art is already 32×32. The image optimizer would resample it.
    // biome-ignore lint/performance/noImgElement: keep pixel edges crisp
    <img
      className="terrain-portrait"
      src={`/mosslings/portraits/${file}.png`}
      alt={label}
    />
  );
}
