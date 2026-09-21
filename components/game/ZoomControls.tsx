export function ZoomControls({
  tileSize,
  ready,
  onZoom,
}: {
  tileSize: number;
  ready: boolean;
  onZoom: (direction: number) => void;
}) {
  return (
    <fieldset className="zoom-controls" aria-label="Map zoom">
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={!ready || tileSize === 8}
        onClick={() => onZoom(-1)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={!ready || tileSize === 32}
        onClick={() => onZoom(1)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M5 12h14M12 5v14" />
        </svg>
      </button>
    </fieldset>
  );
}
