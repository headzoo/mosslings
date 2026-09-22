export function ZoomControls({
  tileSize,
  ready,
  moveMode,
  onToggleMove,
  onZoom,
}: {
  tileSize: number;
  ready: boolean;
  moveMode: boolean;
  onToggleMove: () => void;
  onZoom: (direction: number) => void;
}) {
  return (
    <fieldset className="zoom-controls" aria-label="Map view">
      <button
        type="button"
        aria-label="Move map"
        title="Move map"
        aria-pressed={moveMode}
        disabled={!ready || tileSize <= 8}
        onClick={onToggleMove}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
          <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </button>
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
