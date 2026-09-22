"use client";

import Image from "next/image";
import {
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
import {
  INTRO_CAMERA_TILE_SIZE,
  introClusterCenter,
  introSpotlightRadiusPx,
} from "@/lib/intro-mosslings";
import type { MapCell, MapData } from "@/lib/map";
import { type Camera, getCamera, zoomAtPoint } from "@/lib/map-camera";
import type { PreviewMossling } from "@/lib/map-preview";
import {
  mapToolFromKeyboard,
  shouldIgnoreMapToolShortcut,
} from "@/lib/map-tool-shortcuts";
import { detailMode, SPRITE_ZOOM } from "@/lib/mossling-detail";
import { canvasToPng, captureViewport } from "@/lib/screenshot";
import {
  clusterSpecies,
  nearestMember,
  type SpeciesGroup,
  speciesKey,
} from "@/lib/species";
import { speciesName } from "@/lib/species-name";
import { terrainDetailActive } from "@/lib/terrain-detail";
import { CoughBubbles } from "./CoughBubbles";
import { CropIntro } from "./CropIntro";
import { CurseBubbles } from "./CurseBubbles";
import { type DisasterId, isDisasterPower } from "./DestroyedStatIcon";
import { GameMap, Minimap } from "./GameMap";
import { GodControls } from "./GodControls";
import { GodEffects } from "./GodEffects";
import { Health } from "./Health";
import { Kites } from "./Kites";
import {
  ExtinctionModal,
  LoreBoard,
  NEWS_MS,
  type NewsFlash,
} from "./LoreBoard";
import { MatingHearts } from "./MatingHearts";
import { MosslingDetail } from "./MosslingDetail";
import { type IntroPhase, MosslingIntro } from "./MosslingIntro";
import { MoveIntro } from "./MoveIntro";
import { Pollinators } from "./Pollinators";
import { ScreenshotModal } from "./ScreenshotModal";
import { SeasonDim } from "./SeasonDim";
import { SkyClouds } from "./SkyClouds";
import { SoccerBall } from "./SoccerBall";
import { SpeciesList } from "./SpeciesList";
import { TerrainDetail } from "./TerrainDetail";
import { TileInspector } from "./TileInspector";
import { PlayControls, Year } from "./TimeControls";
import { useGameTime } from "./useGameTime";
import { useGodWorld } from "./useGodWorld";
import {
  isCropIntroDismissed,
  isMoveIntroDismissed,
  rememberCropIntroDismissal,
  rememberMoveIntroDismissal,
} from "./WelcomeSplash";
import { type MapTool, ZoomControls } from "./ZoomControls";

type TileSelection = {
  seed: number;
  index: number;
  x: number;
  y: number;
  cell: MapCell;
  mossling?: PreviewMossling;
  speciesKey?: string;
};
type MosslingTarget = {
  mosslingId: number;
  label: string;
  mode: "move" | "clone";
};

function snapshotCell(cell: MapCell): MapCell {
  return cell.tree ? { ...cell, tree: { ...cell.tree } } : { ...cell };
}

const DEFAULT_CENTER = { x: 0.5, y: 0.5 };
const INTRO_TILE_SIZE = INTRO_CAMERA_TILE_SIZE;
const DEFAULT_TILE_SIZE = 8;
const CAMERA_ANIM_MS = 400;

export function GameScreen({
  map: initialMap,
  mosslings: initialMosslings,
  boardRef,
  suspended = false,
  introPhase = null,
  onIntroContinue,
  onRestoreWelcome,
}: {
  map: MapData | null;
  mosslings: PreviewMossling[];
  boardRef?: Ref<HTMLDivElement>;
  suspended?: boolean;
  introPhase?: IntroPhase | null;
  onIntroContinue?: () => void;
  onRestoreWelcome: () => void;
}) {
  const introActive = introPhase !== null;
  const [cropIntroOpen, setCropIntroOpen] = useState(false);
  const cropIntroTriggered = useRef(false);
  const [mapControlsIntroOpen, setMapControlsIntroOpen] = useState(false);
  const mapControlsIntroTriggered = useRef(false);
  const tutorialPaused = introActive || cropIntroOpen || mapControlsIntroOpen;
  const gameTime = useGameTime(
    suspended || cropIntroOpen || mapControlsIntroOpen,
  );
  const {
    map,
    mosslings,
    engine,
    cast,
    moveMossling,
    cloneMossling,
    events,
    resources,
    revisionRef,
    subscribeFrame,
  } = useGodWorld(
    initialMap,
    initialMosslings,
    gameTime.getDate,
    gameTime.getElapsed,
  );
  const [power, setPower] = useState<PowerId | null>(null);
  const [mosslingTarget, setMosslingTarget] = useState<MosslingTarget | null>(
    null,
  );
  const [placementMessage, setPlacementMessage] = useState("");
  const [placementTooltip, setPlacementTooltip] = useState<{
    message: string;
    x: number;
    y: number;
  } | null>(null);
  const [destroyedHudFlash, setDestroyedHudFlash] = useState<{
    kind: DisasterId;
    effectId: number;
  } | null>(null);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog[open]")) {
        return;
      }
      setPower(null);
      setMosslingTarget(null);
      setPlacementMessage("");
      setPlacementTooltip(null);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, []);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const speciesListRef = useRef<HTMLElement | null>(null);
  const godRailRef = useRef<HTMLElement | null>(null);
  const zoomControlsRef = useRef<HTMLFieldSetElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [mapShot, setMapShot] = useState<Blob | null>(null);
  const [mapShotProblem, setMapShotProblem] = useState<string | null>(null);
  const [tileSize, setTileSize] = useState(DEFAULT_TILE_SIZE);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [mapTool, setMapTool] = useState<MapTool>("pointer");
  const [panning, setPanning] = useState(false);
  const cameraRef = useRef<Camera | null>(null);
  const cameraAnim = useRef<number | null>(null);
  const cameraState = useRef({
    center: DEFAULT_CENTER,
    tileSize: DEFAULT_TILE_SIZE,
  });
  cameraState.current = { center, tileSize };
  const [selection, setSelection] = useState<TileSelection | null>(null);
  const [flash, setFlash] = useState<NewsFlash | null>(null);
  const [extinctionOpen, setExtinctionOpen] = useState(false);
  const extinctionShown = useRef(false);
  const previousMosslings = useRef<number | null>(null);
  const flashId = useRef(0);
  const blightSeen = useRef(-1);
  const advisoryMemory = useRef<AdvisoryMemory>(EMPTY_ADVISORY_MEMORY);
  const newsUntil = useRef(0);
  useEffect(() => {
    if (cropIntroTriggered.current || isCropIntroDismissed()) return;
    if (events.some((event) => event.tag === "player-crop-planted")) {
      cropIntroTriggered.current = true;
      setCropIntroOpen(true);
    }
  }, [events]);
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
  useEffect(() => {
    if (!map) return;
    const outbreak = events.find((event) => event.tag === "crop-blight");
    if (
      !outbreak ||
      outbreak.id === blightSeen.current ||
      outbreak.x === undefined ||
      outbreak.y === undefined
    )
      return;
    blightSeen.current = outbreak.id;
    newsUntil.current = performance.now() + NEWS_MS;
    setFlash({
      id: ++flashId.current,
      kind: "blight",
      x: outbreak.x,
      y: outbreak.y,
      mapWidth: map.width,
      mapHeight: map.height,
    });
  }, [events, map]);
  useEffect(() => {
    const count = resources?.mosslings;
    if (count == null) return;
    const previous = previousMosslings.current;
    previousMosslings.current = count;
    if (
      extinctionShown.current ||
      previous == null ||
      previous <= 0 ||
      count !== 0
    ) {
      return;
    }
    extinctionShown.current = true;
    setExtinctionOpen(true);
  }, [resources]);
  const stroke = useRef<{
    painting: boolean;
    moved: boolean;
    x: number;
    y: number;
    lastIndex: number | null;
    announced: boolean;
    stopped: boolean;
  } | null>(null);
  const pan = useRef<{
    x: number;
    y: number;
    focusX: number;
    focusY: number;
    viewWidth: number;
    viewHeight: number;
  } | null>(null);
  const zoomGesture = useRef<{
    x: number;
    y: number;
    moved: boolean;
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
    (direction: number) => {
      if (tutorialPaused) return;
      setTileSize((size) => Math.max(8, Math.min(32, size + direction * 8)));
    },
    [tutorialPaused],
  );
  const stopPan = useCallback(() => {
    pan.current = null;
    setPanning(false);
  }, []);
  const maybeOpenMapControlsIntro = useCallback(() => {
    if (mapControlsIntroTriggered.current || isMoveIntroDismissed()) return;
    mapControlsIntroTriggered.current = true;
    setMapControlsIntroOpen(true);
  }, []);
  const selectMapTool = useCallback(
    (next: MapTool) => {
      maybeOpenMapControlsIntro();
      if (next === "move" && tileSize <= DEFAULT_TILE_SIZE) return;
      if (next === "zoom-out" && tileSize <= DEFAULT_TILE_SIZE) return;
      if (next === "zoom-in" && tileSize >= 32) return;
      if (next === mapTool && next !== "pointer") {
        setMapTool("pointer");
        stopPan();
        return;
      }
      if (next !== "move") stopPan();
      setMapTool(next);
    },
    [maybeOpenMapControlsIntro, tileSize, mapTool, stopPan],
  );
  useEffect(() => {
    if (
      introActive ||
      cropIntroOpen ||
      (mapTool === "move" && tileSize <= DEFAULT_TILE_SIZE)
    ) {
      setMapTool("pointer");
      stopPan();
    }
  }, [introActive, cropIntroOpen, mapTool, tileSize, stopPan]);
  useEffect(() => {
    if (mapTool === "pointer") return;
    const exit = (event: PointerEvent) => {
      const board = viewportRef.current;
      const target = event.target;
      if (
        target instanceof Node &&
        board?.contains(target) &&
        !(target instanceof Element && target.closest("dialog"))
      )
        return;
      setMapTool("pointer");
      stopPan();
    };
    window.addEventListener("pointerdown", exit);
    return () => window.removeEventListener("pointerdown", exit);
  }, [mapTool, stopPan]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (tutorialPaused || document.querySelector("dialog[open]")) return;
      if (shouldIgnoreMapToolShortcut(event)) return;
      const tool = mapToolFromKeyboard(event);
      if (!tool) return;
      event.preventDefault();
      selectMapTool(tool);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tutorialPaused, selectMapTool]);
  useEffect(() => {
    if (!map) return;
    const introZoomed =
      introPhase === "mosslings" ||
      introPhase === "species" ||
      introPhase === "powers";
    const targetCenter = introZoomed ? introClusterCenter(map) : DEFAULT_CENTER;
    const targetTileSize = introZoomed ? INTRO_TILE_SIZE : DEFAULT_TILE_SIZE;
    const from = cameraState.current;
    const start = performance.now();
    if (cameraAnim.current) cancelAnimationFrame(cameraAnim.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / CAMERA_ANIM_MS);
      const ease = t * (2 - t);
      setCenter({
        x: from.center.x + (targetCenter.x - from.center.x) * ease,
        y: from.center.y + (targetCenter.y - from.center.y) * ease,
      });
      setTileSize(from.tileSize + (targetTileSize - from.tileSize) * ease);
      if (t < 1) {
        cameraAnim.current = requestAnimationFrame(tick);
      } else {
        setCenter(targetCenter);
        setTileSize(targetTileSize);
        cameraAnim.current = null;
      }
    };
    cameraAnim.current = requestAnimationFrame(tick);
    return () => {
      if (cameraAnim.current) cancelAnimationFrame(cameraAnim.current);
    };
  }, [introPhase, map]);
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
        board.querySelector("dialog[open]") ||
        board.querySelector(".mossling-intro")
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
  cameraRef.current = camera;
  const introSpotlight =
    introPhase === "mosslings" && map && camera
      ? (() => {
          const cluster = introClusterCenter(map);
          return {
            x: camera.left + cluster.x * map.width * tileSize,
            y: camera.top + cluster.y * map.height * tileSize,
            r: introSpotlightRadiusPx(tileSize),
          };
        })()
      : null;
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
    if (
      message === null &&
      isDisasterPower(power) &&
      engine?.effects.at(-1)?.kind === power
    ) {
      const placed = engine.effects.at(-1);
      if (placed) {
        setDestroyedHudFlash({ kind: power, effectId: placed.id });
      }
    }
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
  const cancelMosslingTarget = () => {
    setMosslingTarget(null);
    setPlacementMessage("");
    setPlacementTooltip(null);
  };
  const beginMosslingTarget = (
    mosslingId: number,
    label: string,
    mode: "move" | "clone",
  ) => {
    setSelection(null);
    setPower(null);
    setPlacementMessage("");
    setPlacementTooltip(null);
    setMosslingTarget({ mosslingId, label, mode });
  };
  const placeMosslingTarget = (x: number, y: number) => {
    if (!mosslingTarget) return;
    const message =
      mosslingTarget.mode === "move"
        ? moveMossling(mosslingTarget.mosslingId, x, y)
        : cloneMossling(mosslingTarget.mosslingId, x, y);
    if (message) {
      setPlacementTooltip({ message, x, y });
      return;
    }
    cancelMosslingTarget();
  };
  const selectAt = (clientX: number, clientY: number) => {
    const tile = tileAt(clientX, clientY);
    if (mosslingTarget) {
      if (!tile) {
        cancelMosslingTarget();
        return;
      }
      placeMosslingTarget(tile.x, tile.y);
      return;
    }
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
    if (tutorialPaused || !map) return;
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
  const species = useMemo(() => clusterSpecies(mosslings), [mosslings]);
  useEffect(() => {
    if (!map || !selection?.speciesKey || selection.seed !== map.seed) return;
    const group = species.find((item) => item.key === selection.speciesKey);
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
  }, [map, camera, mosslings, selection, species]);
  const selected = selection?.seed === map?.seed ? selection : null;
  const highlighted = selected?.speciesKey
    ? (species.find((group) => group.key === selected.speciesKey)?.members ??
      [])
    : [];
  const highlightedIds = new Set(highlighted.map((mossling) => mossling.id));
  const highlightRef = useRef(highlightedIds);
  highlightRef.current = highlightedIds;
  const mosslingDetail = detailMode(tileSize);
  const roundMosslings = mosslingDetail !== "square";
  const selectedMossling = selected?.mossling
    ? mosslings.find((item) => item.id === selected.mossling?.id)
    : undefined;
  const selectedSpeciesName = selectedMossling
    ? (species.find((group) =>
        group.members.some((member) => member.id === selectedMossling.id),
      )?.name ?? speciesName(speciesKey(selectedMossling)))
    : undefined;
  const activeDestroyedDisaster =
    destroyedHudFlash &&
    engine?.effects.some((effect) => effect.id === destroyedHudFlash.effectId)
      ? destroyedHudFlash.kind
      : null;
  return (
    <main className="game-screen">
      <header className="game-header">
        <div className="brand">
          <Image
            className="brand-logo"
            src="/mosslings/logo-header-lg.png"
            width={1271}
            height={430}
            sizes="(max-width: 620px) 203px, (max-width: 900px) 225px, (max-width: 1300px) 234px, 302px"
            loading="eager"
            alt="Mosslings — Small genetic wonders"
          />
        </div>
        <Health
          resources={resources}
          rate={gameTime.rate}
          isPlaying={gameTime.isPlaying}
          elapsed={gameTime.getElapsed}
          activeDisaster={activeDestroyedDisaster}
        />
        <Year
          year={gameTime.year}
          season={gameTime.season}
          elapsed={gameTime.getElapsed}
        />
        <PlayControls
          isPlaying={gameTime.isPlaying}
          rate={gameTime.rate}
          onToggle={gameTime.togglePlaying}
          onSkip={gameTime.skipToNextSpring}
          onFastForward={gameTime.fastForward}
          onRestoreWelcome={onRestoreWelcome}
          onScreenshot={
            map
              ? () => {
                  const board = viewportRef.current;
                  if (!board) return;
                  try {
                    const canvas = captureViewport(board);
                    void canvasToPng(canvas)
                      .then((blob) => {
                        setMapShotProblem(null);
                        setMapShot(blob);
                      })
                      .catch(() => {
                        setMapShot(null);
                        setMapShotProblem("The map couldn't be captured.");
                      });
                  } catch {
                    setMapShot(null);
                    setMapShotProblem("The map couldn't be captured.");
                  }
                }
              : undefined
          }
        />
      </header>
      <div className="game-body">
        <GodControls
          ref={godRailRef}
          selected={power}
          disabled={!engine || tutorialPaused}
          highlighted={introPhase === "powers"}
          onSelect={(next) => {
            setPower((current) => (current === next ? null : next));
            setMosslingTarget(null);
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
              data-targeting={!!power || !!mosslingTarget}
              data-move={mapTool === "move"}
              data-zoom={
                mapTool === "zoom-in"
                  ? "in"
                  : mapTool === "zoom-out"
                    ? "out"
                    : undefined
              }
              data-panning={panning}
              aria-label={
                mapTool === "zoom-in"
                  ? "Map camera: click to zoom in"
                  : mapTool === "zoom-out"
                    ? "Map camera: click to zoom out"
                    : mapTool === "move"
                      ? "Map camera: drag to move the map"
                      : "Map camera: click a tile to inspect"
              }
              onClick={(event) => {
                if (tutorialPaused || mapTool !== "pointer") return;
                if (event.detail === 0 && viewportRef.current) {
                  const rect = viewportRef.current.getBoundingClientRect();
                  selectAt(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2,
                  );
                }
              }}
              onKeyDown={(event) => {
                if (tutorialPaused) return;
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
                if (tutorialPaused || !map || !camera || event.button !== 0)
                  return;
                event.currentTarget.setPointerCapture(event.pointerId);
                if (mapTool === "zoom-in" || mapTool === "zoom-out") {
                  zoomGesture.current = {
                    x: event.clientX,
                    y: event.clientY,
                    moved: false,
                  };
                  return;
                }
                if (mapTool === "move") {
                  pan.current = {
                    x: event.clientX,
                    y: event.clientY,
                    focusX: camera.x + camera.width / 2,
                    focusY: camera.y + camera.height / 2,
                    viewWidth: camera.width,
                    viewHeight: camera.height,
                  };
                  setPanning(true);
                  return;
                }
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
                if (zoomGesture.current) {
                  if (
                    !zoomGesture.current.moved &&
                    Math.hypot(
                      event.clientX - zoomGesture.current.x,
                      event.clientY - zoomGesture.current.y,
                    ) > 5
                  )
                    zoomGesture.current.moved = true;
                  return;
                }
                const drag = pan.current;
                if (drag && map) {
                  const focusX =
                    drag.focusX - (event.clientX - drag.x) / tileSize;
                  const focusY =
                    drag.focusY - (event.clientY - drag.y) / tileSize;
                  const minX = drag.viewWidth / 2;
                  const maxX = map.width - drag.viewWidth / 2;
                  const minY = drag.viewHeight / 2;
                  const maxY = map.height - drag.viewHeight / 2;
                  setCenter({
                    x: Math.max(minX, Math.min(maxX, focusX)) / map.width,
                    y: Math.max(minY, Math.min(maxY, focusY)) / map.height,
                  });
                  return;
                }
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
                if (zoomGesture.current) {
                  const gesture = zoomGesture.current;
                  zoomGesture.current = null;
                  if (
                    !gesture.moved &&
                    (mapTool === "zoom-in" || mapTool === "zoom-out") &&
                    map &&
                    camera &&
                    viewportRef.current
                  ) {
                    const rect = viewportRef.current.getBoundingClientRect();
                    const next = zoomAtPoint(
                      map,
                      viewport,
                      tileSize,
                      camera,
                      {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                      },
                      mapTool === "zoom-in" ? 1 : -1,
                    );
                    setTileSize(next.tileSize);
                    setCenter(next.center);
                  }
                  return;
                }
                if (pan.current) {
                  stopPan();
                  return;
                }
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
                zoomGesture.current = null;
                stopPan();
              }}
              onLostPointerCapture={() => {
                stroke.current = null;
                zoomGesture.current = null;
                stopPan();
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
                subscribeFrame={subscribeFrame}
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
            {map && camera && terrainDetailActive(tileSize) && (
              <TerrainDetail
                map={map}
                camera={camera}
                cameraRef={cameraRef}
                tileSize={tileSize}
                elapsed={gameTime.getElapsed}
                revisionRef={revisionRef}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && roundMosslings && (
              <MosslingDetail
                map={map}
                mosslings={mosslings}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                highlightRef={highlightRef}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && tileSize >= SPRITE_ZOOM && (
              <Kites
                map={map}
                mosslings={mosslings}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map &&
              camera &&
              mosslings.length > 0 &&
              mosslingDetail === "square" && (
                <div
                  className="species-highlights"
                  style={{
                    left: camera.left,
                    top: camera.top,
                    width: map.width * tileSize,
                    height: map.height * tileSize,
                  }}
                >
                  {mosslings.map((mossling) => (
                    <span
                      key={mossling.id}
                      className={
                        highlightedIds.has(mossling.id)
                          ? "mossling-outline mossling-outline--tint"
                          : "mossling-outline"
                      }
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
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                revisionRef={revisionRef}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && (
              <MatingHearts
                map={map}
                mosslings={mosslings}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && (
              <SoccerBall
                map={map}
                mosslings={mosslings}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && (
              <CoughBubbles
                map={map}
                mosslings={mosslings}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
              />
            )}
            {engine && camera && (
              <CurseBubbles
                engine={engine}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && (
              <SkyClouds
                seed={map.seed}
                mapWidth={map.width}
                mapHeight={map.height}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
              />
            )}
            {engine && camera && (
              <GodEffects
                engine={engine}
                cameraRef={cameraRef}
                tileSize={tileSize}
                width={viewport.width}
                height={viewport.height}
                subscribeFrame={subscribeFrame}
              />
            )}
            {map && camera && (
              <SeasonDim
                elapsed={gameTime.getElapsed}
                subscribeFrame={subscribeFrame}
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
            {mosslingTarget && (
              <output className="power-placement">
                <strong>
                  {mosslingTarget.mode === "move" ? "Move" : "Clone"}{" "}
                  {mosslingTarget.label}
                </strong>
                <span>Choose a tile · Esc to cancel</span>
                <button
                  type="button"
                  aria-label={
                    mosslingTarget.mode === "move"
                      ? "Cancel move"
                      : "Cancel clone"
                  }
                  onClick={cancelMosslingTarget}
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
            {cropIntroOpen && (
              <CropIntro
                onDismiss={() => {
                  try {
                    rememberCropIntroDismissal();
                  } catch {
                    // Best-effort preference; still close the callout.
                  }
                  setCropIntroOpen(false);
                }}
              />
            )}
            {mapControlsIntroOpen && (
              <MoveIntro
                anchorRef={zoomControlsRef}
                onDismiss={() => {
                  try {
                    rememberMoveIntroDismissal();
                  } catch {
                    // Best-effort preference; still close the callout.
                  }
                  setMapControlsIntroOpen(false);
                }}
              />
            )}
            {introPhase &&
              introPhase !== "species" &&
              introPhase !== "powers" &&
              onIntroContinue && (
                <MosslingIntro
                  phase={introPhase}
                  onContinue={onIntroContinue}
                  spotlight={introSpotlight}
                />
              )}
            <ZoomControls
              ref={zoomControlsRef}
              tileSize={tileSize}
              ready={!!map && !tutorialPaused}
              tool={mapTool}
              onSelectTool={selectMapTool}
            />
            {selected && (
              <TileInspector
                seed={selected.seed}
                x={selected.x}
                y={selected.y}
                cell={selected.cell}
                map={map}
                mossling={selectedMossling}
                speciesName={selectedSpeciesName}
                hostRef={viewportRef}
                onClose={() => setSelection(null)}
                onMove={
                  selected.mossling && !tutorialPaused
                    ? () => {
                        const mossling = mosslings.find(
                          (m) => m.id === selected.mossling?.id,
                        );
                        if (!mossling || (mossling.health ?? 100) <= 0) return;
                        beginMosslingTarget(
                          mossling.id,
                          selectedSpeciesName ??
                            speciesName(speciesKey(mossling)),
                          "move",
                        );
                      }
                    : undefined
                }
                onClone={
                  selected.mossling && !tutorialPaused
                    ? () => {
                        const mossling = mosslings.find(
                          (m) => m.id === selected.mossling?.id,
                        );
                        if (!mossling || (mossling.health ?? 100) <= 0) return;
                        beginMosslingTarget(
                          mossling.id,
                          selectedSpeciesName ??
                            speciesName(speciesKey(mossling)),
                          "clone",
                        );
                      }
                    : undefined
                }
                elapsed={gameTime.getElapsed}
              />
            )}
          </div>
          <LoreBoard flash={flash} />
          <ExtinctionModal
            open={extinctionOpen}
            onClose={() => setExtinctionOpen(false)}
          />
        </section>
        <aside className="world-sidebar">
          <SpeciesList
            ref={speciesListRef}
            groups={species}
            selectedKey={selected?.speciesKey ?? null}
            onSelect={selectSpecies}
            highlighted={introPhase === "species"}
          />
          <Minimap
            map={map}
            mosslings={mosslings}
            camera={camera}
            tileSize={tileSize}
            elapsed={gameTime.getElapsed}
            revisionRef={revisionRef}
            subscribeFrame={subscribeFrame}
            onCenter={(x, y) => setCenter({ x, y })}
          />
        </aside>
      </div>
      {introPhase === "species" && onIntroContinue && (
        <MosslingIntro
          phase="species"
          onContinue={onIntroContinue}
          highlightRef={speciesListRef}
        />
      )}
      {introPhase === "powers" && onIntroContinue && (
        <MosslingIntro
          phase="powers"
          onContinue={onIntroContinue}
          highlightRef={godRailRef}
        />
      )}
      {(mapShot || mapShotProblem) && (
        <ScreenshotModal
          blob={mapShot ?? undefined}
          filename="mosslings.png"
          kind="map"
          problem={mapShotProblem ?? undefined}
          onDismiss={() => {
            setMapShot(null);
            setMapShotProblem(null);
          }}
        />
      )}
    </main>
  );
}
