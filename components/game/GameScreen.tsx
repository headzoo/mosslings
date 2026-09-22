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
import { EFFECT_CAP_MESSAGE } from "@/lib/god/engine";
import type { PowerId } from "@/lib/god/types";
import type { MapCell, MapData } from "@/lib/map";
import { getCamera } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import { groupSpecies, nearestMember, type SpeciesGroup } from "@/lib/species";
import { GameMap, Minimap } from "./GameMap";
import { GodControls } from "./GodControls";
import { GodEffects } from "./GodEffects";
import { Health } from "./Health";
import { LoreBoard, NEWS_MS, type NewsFlash } from "./LoreBoard";
import { Pollinators } from "./Pollinators";
import { SkyClouds } from "./SkyClouds";
import { SpeciesList } from "./SpeciesList";
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
  speciesKey?: string;
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
  const { map, mosslings, engine, cast, events, resources, revisionRef } =
    useGodWorld(
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
  const stroke = useRef<{
    painting: boolean;
    moved: boolean;
    x: number;
    y: number;
    lastIndex: number | null;
    announced: boolean;
    stopped: boolean;
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
  const tileAt = (clientX: number, clientY: number) => {
    if (!map || !camera || !viewportRef.current) return null;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - camera.left) / tileSize);
    const y = Math.floor((clientY - rect.top - camera.top) / tileSize);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return { x, y, index: y * map.width + x };
  };
  const flashDisaster = (kind: PowerId, x: number, y: number) => {
    if (
      !map ||
      (kind !== "fire" &&
        kind !== "tornado" &&
        kind !== "quake" &&
        kind !== "lightning" &&
        kind !== "meteor")
    )
      return;
    newsUntil.current = performance.now() + NEWS_MS;
    setFlash({
      id: ++flashId.current,
      kind,
      x,
      y,
      mapWidth: map.width,
      mapHeight: map.height,
    });
  };
  const placePower = (x: number, y: number, quiet: boolean) => {
    if (!power || !map) return false;
    const message = cast(power, x, y, quiet ? { quiet: true } : undefined);
    if (message === EFFECT_CAP_MESSAGE) {
      if (!quiet && power === "raze") {
        setPlacementTooltip({ message, x, y });
        setPlacementMessage("");
      } else {
        setPlacementTooltip(null);
        setPlacementMessage(message);
      }
      return true;
    }
    if (quiet) {
      if (message || stroke.current?.announced) return false;
      if (stroke.current) stroke.current.announced = true;
      setPlacementTooltip(null);
      setPlacementMessage(
        `${GOD_ACTIONS[power].label} placed. Choose another spot, or Esc to cancel.`,
      );
      flashDisaster(power, x, y);
      return false;
    }
    if (stroke.current) stroke.current.announced = !message;
    if (!message) flashDisaster(power, x, y);
    if (power === "raze" && message) {
      setPlacementTooltip({ message, x, y });
      setPlacementMessage("");
    } else {
      setPlacementTooltip(null);
      setPlacementMessage(
        message ??
          `${GOD_ACTIONS[power].label} placed. Choose another spot, or Esc to cancel.`,
      );
    }
    return false;
  };
  const selectAt = (clientX: number, clientY: number) => {
    const tile = tileAt(clientX, clientY);
    if (!tile || !map) return;
    if (power) {
      placePower(tile.x, tile.y, false);
      return;
    }
    const mossling = mosslings.find((m) => m.cellIndex === tile.index);
    setSelection({
      seed: map.seed,
      index: tile.index,
      x: tile.x,
      y: tile.y,
      cell: snapshotCell(map.cells[tile.index]),
      mossling: mossling ? { ...mossling } : undefined,
    });
  };
  const selectSpecies = (group: SpeciesGroup) => {
    if (!map) return;
    const focus = camera
      ? {
          x: camera.x + camera.width / 2,
          y: camera.y + camera.height / 2,
        }
      : { x: 0, y: 0 };
    const member =
      nearestMember(group.members, map.width, focus) ?? group.members[0];
    const cell = member ? map.cells[member.cellIndex] : undefined;
    if (!member || !cell) return;
    setSelection({
      seed: map.seed,
      index: member.cellIndex,
      x: member.cellIndex % map.width,
      y: Math.floor(member.cellIndex / map.width),
      cell: snapshotCell(cell),
      mossling: { ...member },
      speciesKey: group.key,
    });
  };
  useEffect(() => {
    if (!map || !selection?.speciesKey || selection.seed !== map.seed) return;
    const group = groupSpecies(mosslings).find(
      (item) => item.key === selection.speciesKey,
    );
    if (!group) {
      setSelection(null);
      return;
    }
    const opened = mosslings.find((item) => item.id === selection.mossling?.id);
    if (opened && (opened.health ?? 100) > 0) return;
    const focus = camera
      ? {
          x: camera.x + camera.width / 2,
          y: camera.y + camera.height / 2,
        }
      : { x: 0, y: 0 };
    const next = nearestMember(group.members, map.width, focus);
    const cell = next ? map.cells[next.cellIndex] : undefined;
    if (!next || !cell) {
      setSelection(null);
      return;
    }
    setSelection({
      seed: map.seed,
      index: next.cellIndex,
      x: next.cellIndex % map.width,
      y: Math.floor(next.cellIndex / map.width),
      cell: snapshotCell(cell),
      mossling: { ...next },
      speciesKey: group.key,
    });
  }, [map, camera, mosslings, selection]);
  const selected = selection?.seed === map?.seed ? selection : null;
  const species = groupSpecies(mosslings);
  const highlighted = selected?.speciesKey
    ? (species.find((group) => group.key === selected.speciesKey)?.members ??
      [])
    : [];
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
              data-targeting={!!power}
              aria-label="Map camera: click a tile to inspect, use plus and minus to zoom"
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
                event.currentTarget.setPointerCapture(event.pointerId);
                const tile = tileAt(event.clientX, event.clientY);
                stroke.current = {
                  painting: !!power,
                  moved: false,
                  x: event.clientX,
                  y: event.clientY,
                  lastIndex: tile?.index ?? null,
                  announced: false,
                  stopped: false,
                };
                if (power && tile)
                  stroke.current.stopped = placePower(tile.x, tile.y, false);
              }}
              onPointerMove={(event) => {
                if (!stroke.current) return;
                if (
                  !stroke.current.moved &&
                  Math.hypot(
                    event.clientX - stroke.current.x,
                    event.clientY - stroke.current.y,
                  ) > 5
                )
                  stroke.current.moved = true;
                if (
                  !power ||
                  !map ||
                  !camera ||
                  !stroke.current.painting ||
                  !stroke.current.moved ||
                  stroke.current.stopped
                )
                  return;
                const tile = tileAt(event.clientX, event.clientY);
                if (!tile || tile.index === stroke.current.lastIndex) return;
                stroke.current.lastIndex = tile.index;
                stroke.current.stopped = placePower(tile.x, tile.y, true);
              }}
              onPointerUp={(event) => {
                if (
                  stroke.current &&
                  !stroke.current.painting &&
                  !stroke.current.moved
                )
                  selectAt(event.clientX, event.clientY);
                stroke.current = null;
              }}
              onPointerCancel={() => {
                stroke.current = null;
              }}
              onLostPointerCapture={() => {
                stroke.current = null;
              }}
            >
              <span className="sr-only">Map camera</span>
            </button>
            {map ? (
              <GameMap
                map={map}
                mosslings={mosslings}
                elapsed={gameTime.getElapsed}
                revisionRef={revisionRef}
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
            {map && camera && highlighted.length > 0 && (
              <div
                className="species-highlights"
                style={{
                  left: camera.left,
                  top: camera.top,
                  width: map.width * tileSize,
                  height: map.height * tileSize,
                }}
              >
                {highlighted.map((mossling) => (
                  <span
                    key={mossling.id}
                    className="species-highlight"
                    style={{
                      left: (mossling.cellIndex % map.width) * tileSize,
                      top:
                        Math.floor(mossling.cellIndex / map.width) * tileSize,
                      width: tileSize,
                      height: tileSize,
                    }}
                  />
                ))}
              </div>
            )}
            {map && camera && (
              <Pollinators
                map={map}
                camera={camera}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                revisionRef={revisionRef}
              />
            )}
            {map && camera && (
              <SkyClouds
                seed={map.seed}
                mapWidth={map.width}
                mapHeight={map.height}
                camera={camera}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
              />
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
                x={selected.x}
                y={selected.y}
                cell={selected.cell}
                map={map}
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
          <SpeciesList
            groups={species}
            selectedKey={selected?.speciesKey ?? null}
            onSelect={selectSpecies}
          />
          <Minimap
            map={map}
            mosslings={mosslings}
            camera={camera}
            tileSize={tileSize}
            elapsed={gameTime.getElapsed}
            revisionRef={revisionRef}
            onCenter={(x, y) => setCenter({ x, y })}
          />
        </aside>
      </div>
    </main>
  );
}
