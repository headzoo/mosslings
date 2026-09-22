const icons = {
  leaf: [
    "......g.....",
    ".....lgg....",
    "....lgggg...",
    "...lgggggg..",
    "..lggLggggg.",
    ".lgggLggggg.",
    "..lggLgggg..",
    "...lgLggg...",
    "....gLgg....",
    ".....ww.....",
    "......w.....",
    "............",
  ],
  bulletin: [
    "............",
    ".rrrrrrrrrr.",
    ".r........r.",
    ".r.rrrrrr.r.",
    ".r........r.",
    ".r.rrrrrr.r.",
    ".r........r.",
    ".r.rrrrrr.r.",
    ".r........r.",
    ".rrrrrrrrrr.",
    "............",
    "............",
  ],
} as const;

const palette: Record<string, string> = {
  w: "#a57a4c",
  r: "#e54320",
  g: "#4ea234",
  l: "#8ed45c",
  L: "#2d6e28",
};

export type IconName = keyof typeof icons;

export function PixelIcon({ name }: { name: IconName }) {
  const rows = icons[name];
  const pixels = rows.flatMap((row, y) =>
    [...row].flatMap((color, x) =>
      color === "." ? [] : [{ id: `${x}-${y}`, x, y, color }],
    ),
  );
  return (
    <svg
      className="pixel-icon"
      viewBox={`0 0 ${rows[0].length} ${rows.length}`}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      {pixels.map((pixel) => (
        <rect
          key={pixel.id}
          x={pixel.x}
          y={pixel.y}
          width="1"
          height="1"
          fill={palette[pixel.color]}
        />
      ))}
    </svg>
  );
}
