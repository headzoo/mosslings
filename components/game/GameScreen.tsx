"use client";

import Image from "next/image";
import {
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type AdvisoryMemory,
  EMPTY_ADVISORY_MEMORY,
  stepAdvisory,
} from "@/lib/advisories";
import { GOD_ACTIONS } from "@/lib/god/actions";
import type { PowerId } from "@/lib/god/types";
import type { MapCell, MapData } from "@/lib/map";
import { getCamera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import { EventLog } from "./EventLog";
import { GameMap, Minimap } from "./GameMap";
import { GodControls } from "./GodControls";
import { GodEffects } from "./GodEffects";
import { Health } from "./Health";
import { LoreBoard, NEWS_MS, type NewsFlash } from "./LoreBoard";
import { TileInspector } from "./TileInspector";
import { PlayControls, Year } from "./TimeControls";
import { useGameTime } from "./useGameTime";
import { useGodWorld } from "./useGodWorld";
import { ZoomControls } from "./ZoomControls";

type TileSelection = {
  seed: number;
  index: number;
  x: number;
  y: number;
  cell: MapCell;
  mossling?: PreviewMossling;
};

function snapshotCell(cell: MapCell): MapCell {
  return cell.tree ? { ...cell, tree: { ...cell.tree } } : { ...cell };
}

export function GameScreen({
  map: initialMap,
  mosslings: initialMosslings,
  boardRef,
  suspended = false,
  onRestoreWelcome,
}: {
  map: MapData | null;
  mosslings: PreviewMossling[];
  boardRef?: Ref<HTMLDivElement>;
  suspended?: boolean;
  onRestoreWelcome: () => void;
}) {
  const gameTime = useGameTime(suspended);
  const { map, mosslings, engine, cast, events, resources } = useGodWorld(
    initialMap,
    initialMosslings,
    gameTime.getDate,
    gameTime.getElapsed,
  );
  const [power, setPower] = useState<PowerId | null>(null);
  const [placementMessage, setPlacementMessage] = useState("");
  const [placementTooltip, setPlacementTooltip] = useState<{
    message: string;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) {
        return;
      }
      setPower(null);
      setPlacementMessage("");
      setPlacementTooltip(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [tileSize, setTileSize] = useState(8);
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 });
  const [selection, setSelection] = useState<TileSelection | null>(null);
  const [flash, setFlash] = useState<NewsFlash | null>(null);
  const flashId = useRef(0);
  const advisoryMemory = useRef<AdvisoryMemory>(EMPTY_ADVISORY_MEMORY);
  const newsUntil = useRef(0);
  useEffect(() => {
    if (!map || !resources) return;
    const now = performance.now();
    const busy = now < newsUntil.current;
    const step = stepAdvisory(
      { map, mosslings, resources, events },
      advisoryMemory.current,
      now,
      !busy,
    );
    advisoryMemory.current = step.memory;
    if (!busy && step.kind) {
      newsUntil.current = now + NEWS_MS;
      setFlash({ id: ++flashId.current, kind: step.kind });
    }
  }, [map, mosslings, resources, events]);
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{
    moved: boolean;
    x: number;
    y: number;
    centerX: number;
    centerY: number;
  } | null>(null);
  const attachBoard = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (typeof boardRef === "function") boardRef(node);
      else if (boardRef) boardRef.current = node;
    },
    [boardRef],
  );
  const zoom = useCallback(
    (direction: number) =>
      setTileSize((size) => Math.max(8, Math.min(32, size + direction * 8))),
    [],
  );
  useLayoutEffect(() => {
    const board = viewportRef.current;
    if (!board) return;
    const measure = () =>
      setViewport({ width: board.clientWidth, height: board.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(board);
    let lastWheel = -Infinity;
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.deltaY === 0 ||
        board.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      if (performance.now() - lastWheel < 140) return;
      lastWheel = performance.now();
      zoom(event.deltaY < 0 ? 1 : -1);
    };
    board.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      board.removeEventListener("wheel", wheel);
    };
  }, [zoom]);
  const camera = map ? getCamera(map, viewport, tileSize, center) : null;
  const selectAt = (clientX: number, clientY: number) => {
    if (!map || !camera || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - camera.left) / tileSize);
    const y = Math.floor((clientY - rect.top - camera.top) / tileSize);
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) {
      if (power) {
        const message = cast(power, x, y);
        if (
          !message &&
          (power === "fire" ||
            power === "tornado" ||
            power === "quake" ||
            power === "lightning" ||
            power === "meteor")
        ) {
          newsUntil.current = performance.now() + NEWS_MS;
          setFlash({
            id: ++flashId.current,
            kind: power,
            x,
            y,
            mapWidth: map.width,
            mapHeight: map.height,
          });
        }
        if (power === "grow" && message) {
          setPlacementTooltip({ message, x, y });
          setPlacementMessage("");
        } else {
          setPlacementTooltip(null);
          setPlacementMessage(
            message ??
              `${GOD_ACTIONS[power].label} placed. Choose another spot, or Esc to cancel.`,
          );
        }
        return;
      }
      const index = y * map.width + x;
      const mossling = mosslings.find((m) => m.cellIndex === index);
      setSelection({
        seed: map.seed,
        index,
        x,
        y,
        cell: snapshotCell(map.cells[index]),
        mossling: mossling ? { ...mossling } : undefined,
      });
    }
  };
  const selected = selection?.seed === map?.seed ? selection : null;
  return (
    <main className="game-screen">
      <header className="game-header">
        <div className="brand">
          <Image
            className="brand-logo"
            src="/mosslings/logo-8bit.png"
            width={1271}
            height={430}
            sizes="(max-width: 620px) 203px, (max-width: 900px) 225px, (max-width: 1300px) 234px, 302px"
            loading="eager"
            alt="Mosslings — Small bits of wonder"
          />
        </div>
        <Health resources={resources} />
        <Year
          year={gameTime.year}
          season={gameTime.season}
          rate={gameTime.rate}
          isPlaying={gameTime.isPlaying}
        />
        <PlayControls
          isPlaying={gameTime.isPlaying}
          rate={gameTime.rate}
          onToggle={gameTime.togglePlaying}
          onSkip={gameTime.skipToNextSpring}
          onFastForward={gameTime.fastForward}
          onRestoreWelcome={onRestoreWelcome}
        />
      </header>
      <div className="game-body">
        <GodControls
          selected={power}
          disabled={!engine}
          onSelect={(next) => {
            setPower((current) => (current === next ? null : next));
            setPlacementMessage("");
            setPlacementTooltip(null);
            setSelection(null);
          }}
        />
        <section className="board-frame panel" aria-label="Mossling world">
          <div className="board-viewport" ref={attachBoard}>
            <button
              type="button"
              className="camera-surface"
              data-dragging={isDragging}
              data-targeting={!!power}
              aria-label="Map camera: click a tile to inspect, drag to pan, use plus and minus to zoom"
              onClick={(event) => {
                if (event.detail === 0 && viewportRef.current) {
                  const rect = viewportRef.current.getBoundingClientRect();
                  selectAt(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  );
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "+" || event.key === "=") {
                  event.preventDefault();
                  zoom(1);
                }
                if (event.key === "-") {
                  event.preventDefault();
                  zoom(-1);
                }
                if (
                  map &&
                  camera &&
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    event.key,
                  )
                ) {
                  event.preventDefault();
                  setCenter({
                    x: Math.max(
                      0,
                      Math.min(
                        1,
                        (camera.x +
                          camera.width / 2 +
                          (event.key === "ArrowLeft"
                            ? -4
                            : event.key === "ArrowRight"
                              ? 4
                              : 0)) /
                          map.width,
                      ),
                    ),
                    y: Math.max(
                      0,
                      Math.min(
                        1,
                        (camera.y +
                          camera.height / 2 +
                          (event.key === "ArrowUp"
                            ? -4
                            : event.key === "ArrowDown"
                              ? 4
                              : 0)) /
                          map.height,
                      ),
                    ),
                  });
                }
              }}
              onPointerDown={(event) => {
                if (!map || !camera || event.button !== 0) return;
                setIsDragging(false);
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  moved: false,
                  x: event.clientX,
                  y: event.clientY,
                  centerX: camera.x + camera.width / 2,
                  centerY: camera.y + camera.height / 2,
                };
              }}
              onPointerMove={(event) => {
                if (!drag.current || !map || !camera) return;
                if (
                  !drag.current.moved &&
                  Math.hypot(
                    event.clientX - drag.current.x,
                    event.clientY - drag.current.y,
                  ) > 5
                ) {
                  drag.current.moved = true;
                  setIsDragging(true);
                }
                if (!drag.current.moved) return;
                const x =
                  drag.current.centerX -
                  (event.clientX - drag.current.x) / tileSize;
                const y =
                  drag.current.centerY -
                  (event.clientY - drag.current.y) / tileSize;
                setCenter({
                  x:
                    Math.max(
                      camera.width / 2,
                      Math.min(map.width - camera.width / 2, x),
                    ) / map.width,
                  y:
                    Math.max(
                      camera.height / 2,
                      Math.min(map.height - camera.height / 2, y),
                    ) / map.height,
                });
              }}
              onPointerUp={(event) => {
                if (drag.current && !drag.current.moved)
                  selectAt(event.clientX, event.clientY);
                drag.current = null;
                setIsDragging(false);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setIsDragging(false);
              }}
              onLostPointerCapture={() => {
                drag.current = null;
                setIsDragging(false);
              }}
            >
              <span className="sr-only">Map camera</span>
            </button>
            {map ? (
              <GameMap
                map={map}
                mosslings={mosslings}
                elapsed={gameTime.getElapsed}
                style={{
                  position: "absolute",
                  width: map.width * tileSize,
                  height: map.height * tileSize,
                  maxWidth: "none",
                  left: camera?.left ?? 0,
                  top: camera?.top ?? 0,
                }}
              />
            ) : (
              <p className="map-loading">Growing a little world…</p>
            )}
            {engine && camera && (
              <GodEffects
                engine={engine}
                camera={camera}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
              />
            )}
            {placementTooltip && camera && (
              <output
                className="placement-tooltip"
                role="tooltip"
                style={{
                  left: Math.max(
                    92,
                    Math.min(
                      viewport.width - 92,
                      camera.left + (placementTooltip.x + 0.5) * tileSize,
                    ),
                  ),
                  top: Math.max(38, camera.top + placementTooltip.y * tileSize),
                }}
              >
                {placementTooltip.message}
              </output>
            )}
            {power && (
              <output className="power-placement">
                <strong>{GOD_ACTIONS[power].label}</strong>
                <span>
                  {placementMessage || "Choose a tile · Esc to cancel"}
                </span>
                <button
                  type="button"
                  aria-label="Cancel god power"
                  onClick={() => {
                    setPower(null);
                    setPlacementMessage("");
                    setPlacementTooltip(null);
                  }}
                >
                  ×
                </button>
              </output>
            )}
            {gameTime.isPlaying && gameTime.rate > 1 && (
              <output className="time-rate-indicator" aria-live="polite">
                &gt;&gt; {gameTime.rate}x speed
              </output>
            )}
            <ZoomControls tileSize={tileSize} ready={!!map} onZoom={zoom} />
            {selected && (
              <TileInspector
                seed={selected.seed}
                index={selected.index}
                x={selected.x}
                y={selected.y}
                cell={selected.cell}
                mossling={
                  selected.mossling
                    ? mosslings.find((m) => m.id === selected.mossling?.id)
                    : undefined
                }
                hostRef={viewportRef}
                onClose={() => setSelection(null)}
                elapsed={gameTime.getElapsed}
              />
            )}
          </div>
          <LoreBoard flash={flash} />
        </section>
        <aside className="world-sidebar">
          <EventLog events={events} />
          <Minimap
            map={map}
            mosslings={mosslings}
            camera={camera}
            tileSize={tileSize}
            elapsed={gameTime.getElapsed}
          />
        </aside>
      </div>
    </main>
  );
}
