const LOGICAL_WIDTH = 64;
const LOGICAL_HEIGHT = 18;

export function Sparkline({
  values,
  height = LOGICAL_HEIGHT,
  label,
}: {
  values: number[];
  height?: number;
  label: string;
}) {
  const viewBox = `0 0 ${LOGICAL_WIDTH} ${LOGICAL_HEIGHT}`;

  if (values.length < 2) {
    return (
      <svg
        className="sparkline sparkline--empty"
        viewBox={viewBox}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: not enough history yet`}
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 1;
  const innerHeight = LOGICAL_HEIGHT - padding * 2;
  const innerWidth = LOGICAL_WIDTH - padding * 2;
  const points = values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * innerWidth;
      const y =
        padding + innerHeight - ((value - min) / range) * innerHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className="sparkline"
      viewBox={viewBox}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--swatch)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
