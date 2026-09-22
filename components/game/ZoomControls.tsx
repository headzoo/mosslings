import type { Ref } from "react";

export type MapTool = "pointer" | "move" | "zoom-in" | "zoom-out";

function Magnifier({ sign }: { sign: "+" | "-" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="6" />
      <path d="m15.5 15.5 5 5" />
      {sign === "+" ? <path d="M10 7.5v5M7.5 10h5" /> : <path d="M7.5 10h5" />}
    </svg>
  );
}

export function ZoomControls({
  ref,
  tileSize,
  ready,
  tool,
  onSelectTool,
}: {
  ref?: Ref<HTMLFieldSetElement>;
  tileSize: number;
  ready: boolean;
  tool: MapTool;
  onSelectTool: (tool: MapTool) => void;
}) {
  return (
    <fieldset ref={ref} className="zoom-controls" aria-label="Map view">
      <button
        type="button"
        aria-label="Inspect map"
        title="Inspect map"
        aria-pressed={tool === "pointer"}
        disabled={!ready}
        onClick={() => onSelectTool("pointer")}
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
          <path d="M4 4l7 16 2.5-6.5L20 11 4 4z" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Move map"
        title="Move map"
        aria-pressed={tool === "move"}
        disabled={!ready || tileSize <= 8}
        onClick={() => onSelectTool("move")}
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
        aria-pressed={tool === "zoom-out"}
        disabled={!ready || tileSize === 8}
        onClick={() => onSelectTool("zoom-out")}
      >
        <Magnifier sign="-" />
      </button>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        aria-pressed={tool === "zoom-in"}
        disabled={!ready || tileSize === 32}
        onClick={() => onSelectTool("zoom-in")}
      >
        <Magnifier sign="+" />
      </button>
    </fieldset>
  );
}
