"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AdvisoryKind } from "@/lib/advisories";
import { PixelIcon } from "./PixelIcon";

const ROTATE_MS = 14_000;
export const NEWS_MS = 8_000;

export type DisasterKind =
  | "fire"
  | "tornado"
  | "nuke"
  | "lightning"
  | "meteor"
  | "blight";

export type NewsKind = DisasterKind | AdvisoryKind;

export type NewsFlash = {
  id: number;
  kind: NewsKind;
  x?: number;
  y?: number;
  mapWidth?: number;
  mapHeight?: number;
};

function isAdvisory(kind: NewsKind): kind is AdvisoryKind {
  return (
    kind === "approvalLow" ||
    kind === "approvalHigh" ||
    kind === "starve" ||
    kind === "wither" ||
    kind === "dry" ||
    kind === "shade" ||
    kind === "health" ||
    kind === "shortage"
  );
}

const newsItems: Record<
  DisasterKind,
  { image: string; alt: string; line: (region: string) => string }
> = {
  fire: {
    image: "/mosslings/lore/news/fire.png",
    alt: "A moss creature watches a line of flame moving through dry grass.",
    line: (region) =>
      `Fires are raging in ${region}. Some Mosslings may have been killed.`,
  },
  tornado: {
    image: "/mosslings/lore/news/tornado.png",
    alt: "A moss creature watches a small twister cross a meadow.",
    line: (region) =>
      `A twister is loose in ${region}. Some Mosslings may have been carried off.`,
  },
  nuke: {
    image: "/mosslings/lore/news/quake.png",
    alt: "A moss creature watches a mushroom cloud rise over the land.",
    line: (region) =>
      `A nuke falls in ${region}. Some Mosslings may have been lost.`,
  },
  lightning: {
    image: "/mosslings/lore/news/lightning.png",
    alt: "A moss creature watches lightning strike a distant hill.",
    line: (region) =>
      `The sky is striking in ${region}. Some Mosslings may have been hit.`,
  },
  meteor: {
    image: "/mosslings/lore/news/meteor.png",
    alt: "A moss creature looks up at a glowing stone falling from the sky.",
    line: (region) =>
      `Something fell from the sky in ${region}. Some Mosslings may have been flattened.`,
  },
  blight: {
    image: "/mosslings/lore/news/crops.png",
    alt: "A worried moss creature sits beside rows of dead carrots.",
    line: (region) =>
      `A blight is in the carrots in ${region}. The ripe rows are dying.`,
  },
};

const advisoryItems: Record<
  AdvisoryKind,
  { image: string; alt: string; line: string }
> = {
  starve: {
    image: "/mosslings/lore/news/hunger.png",
    alt: "A worried moss creature looks across an empty garden.",
    line: "Mosslings are starving. Bring rain to the garden and plant more Carrots.",
  },
  wither: {
    image: "/mosslings/lore/news/crops.png",
    alt: "A worried moss creature sits beside rows of withered carrots.",
    line: "The carrots are dying. Mossling lives are in danger if God doesn't bring rain!",
  },
  dry: {
    image: "/mosslings/lore/news/crops.png",
    alt: "A worried moss creature sits beside rows of drying carrots.",
    line: "The carrots are drying out. Bring rain before they wither.",
  },
  shade: {
    image: "/mosslings/lore/news/crops.png",
    alt: "A moss creature sits beside a field waiting in the shade.",
    line: "The carrot rows are in shadow. Carrots need sun as well as rain.",
  },
  health: {
    image: "/mosslings/lore/news/health.png",
    alt: "A tired moss creature droops in the grass.",
    line: "Mossling health keeps falling. They need more ripe carrots. Use Carrots, and bring rain if the garden is dry.",
  },
  approvalLow: {
    image: "/mosslings/lore/news/health.png",
    alt: "A tired moss creature droops in the grass.",
    line: "God's approval rating is declining. Praryers aren't being answered. Sick aren't being cured.",
  },
  approvalHigh: {
    image: "/mosslings/lore/peaceful.png",
    alt: "A content moss creature sits in deep moss beside a butterfly.",
    line: "God's approval rating is sky-high! They answer our prarys, and the sick are being cured.",
  },
  shortage: {
    image: "/mosslings/lore/news/hunger.png",
    alt: "A worried moss creature looks across a bare garden.",
    line: "There are not enough carrots. One ripe patch feeds about one Mossling. Use Carrots to plant more.",
  },
};

function NewsMark() {
  return (
    <span className="lore-news-mark" aria-hidden="true">
      <PixelIcon name="bulletin" />
    </span>
  );
}

function bulletin(news: NewsFlash) {
  if (isAdvisory(news.kind)) {
    const item = advisoryItems[news.kind];
    return { text: item.line, image: item.image, alt: item.alt };
  }
  const item = newsItems[news.kind];
  return {
    text: item.line(
      regionPhrase(
        news.x ?? 0,
        news.y ?? 0,
        news.mapWidth ?? 1,
        news.mapHeight ?? 1,
      ),
    ),
    image: item.image,
    alt: item.alt,
  };
}

function regionPhrase(x: number, y: number, width: number, height: number) {
  const north = y < height / 3;
  const south = y >= (height * 2) / 3;
  const west = x < width / 3;
  const east = x >= (width * 2) / 3;
  const northSouth = north ? "north" : south ? "south" : "";
  const eastWest = west ? "west" : east ? "east" : "";
  if (!northSouth && !eastWest) return "the middle of the map";
  return `the ${northSouth}${eastWest} region`;
}

const notes = [
  {
    text: "A brave Mossling will cross three tiles for a friend. A timid one waits until they touch.",
    image: "/mosslings/lore/approach.png",
    alt: "A round moss creature walks a short woodland path toward another waiting ahead.",
  },
  {
    text: "When two Mosslings find each other, they nestle close, and their colors blush in the same soft rhythm.",
    image: "/mosslings/lore/blush.png",
    alt: "Two moss creatures nestle together, one golden and one pink, blushing in the same colors.",
  },
  {
    text: "On the fourth month a little one appears beside them.",
    image: "/mosslings/lore/child.png",
    alt: "Two moss creatures stand with a smaller child whose colors are a blend of both.",
  },
  {
    text: "A fire, a storm, or a death can pull a pair apart. If they cannot reach each other, the courtship ends and no child is born.",
    image: "/mosslings/lore/wildfire.png",
    alt: "Two moss creatures look toward each other across a small wildfire.",
  },
  {
    text: "Panic sends them running. Love can wait.",
    image: "/mosslings/lore/panic.png",
    alt: "A startled moss creature hurries down a path while another waits calmly on a stone.",
  },
  {
    text: "The black death spreads by nearness. Social Mosslings drift toward the sick. The courageous may step closer out of curiosity. Only the cowardly turn away.",
    image: "/mosslings/lore/plague.png",
    alt: "One moss creature dims with the black death while another steps toward it and a third hurries away.",
  },
  {
    text: "What the child inherits is a blend of both parents: courage, curiosity, the colors in their moss.",
    image: "/mosslings/lore/blend.png",
    alt: "A small moss child whose colors mix gold and rose stands before two larger parents.",
  },
  {
    text: "The fields need rain, but soaked ground has its limit. Too much rain in one place turns the land to lasting water.",
    image: "/mosslings/lore/flood.png",
    alt: "A moss creature watches rain pool over a crop field until the ground becomes water.",
  },
  {
    text: "Carrots are a Mossling's favorite food. It is all they grow, and all they eat.",
    image: "/mosslings/lore/carrots.png",
    alt: "A content moss creature sits in a garden of ripe orange carrots.",
  },
  {
    text: "They are peaceful, resilient, and not especially bright. That is part of the charm.",
    image: "/mosslings/lore/peaceful.png",
    alt: "A content moss creature sits in deep moss beside a butterfly.",
  },
  {
    text: "Mosslings are living tufts of moss from forests, ruins, and forgotten places.",
    image: "/mosslings/lore/ruins.png",
    alt: "A small moss creature stands before a mossy stone arch in a quiet ruin.",
  },
  {
    text: "They wander, explore, and quietly make the world a little softer.",
    image: "/mosslings/lore/wander.png",
    alt: "A small moss creature walks a hillside, and the path behind it is greener.",
  },
] as const;

export function LoreBoard({ flash }: { flash: NewsFlash | null }) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [news, setNews] = useState<NewsFlash | null>(null);
  const newsTimer = useRef<number | null>(null);
  const paused = hovered || focused || open || news !== null;
  const advance = useCallback(
    () => setIndex((current) => (current + 1) % notes.length),
    [],
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    if (!flash || newsTimer.current !== null) return;
    setNews(flash);
    newsTimer.current = window.setTimeout(() => {
      newsTimer.current = null;
      setNews(null);
    }, NEWS_MS);
  }, [flash]);
  useEffect(() => {
    return () => {
      if (newsTimer.current !== null) {
        window.clearTimeout(newsTimer.current);
        newsTimer.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(advance, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, advance]);
  const lore = notes[index] ?? notes[0];
  const note = news ? bulletin(news) : lore;
  return (
    <section
      className="lore-board"
      data-news={news ? "" : undefined}
      aria-label={news ? "This Just In!" : "About the Mosslings"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <header className="lore-heading">
        <h2>
          {news ? <NewsMark /> : null}
          {news ? "This Just In!" : "About the Mosslings"}
        </h2>
        {news ? null : (
          <span>
            {index + 1} of {notes.length}
          </span>
        )}
      </header>
      <button
        type="button"
        className="lore-note"
        key={news ? `news-${news.id}` : index}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Image src={note.image} alt={note.alt} width={42} height={42} />
        <p>{note.text}</p>
      </button>
      <button
        type="button"
        className="lore-next lore-next-float"
        onClick={advance}
        disabled={news !== null}
      >
        Next story
      </button>
      {open
        ? createPortal(
            <LoreDialog
              note={note}
              title={news ? "This Just In!" : "About the Mosslings"}
              alert={news !== null}
              canAdvance={news === null}
              onNext={advance}
              onClose={() => setOpen(false)}
            />,
            document.body,
          )
        : null}
    </section>
  );
}

const extinctionNote = {
  text: "No Mosslings remain. Three small graves mark the ground, sticks crossed where the earth was opened and closed again.",
  image: "/mosslings/lore/graves.png",
  alt: "Three makeshift graves of freshly replaced earth, each marked at one end with a cross of sticks.",
};

export function ExtinctionModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return createPortal(
    <LoreDialog note={extinctionNote} showFooter={false} onClose={onClose} />,
    document.body,
  );
}

function LoreDialog({
  note,
  title,
  alert = false,
  canAdvance = false,
  onNext,
  onClose,
  showFooter = true,
}: {
  note: { text: string; image: string; alt: string };
  title?: string;
  alert?: boolean;
  canAdvance?: boolean;
  onNext?: () => void;
  onClose: () => void;
  showFooter?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  onCloseRef.current = onClose;
  const setDialog = useCallback((node: HTMLDialogElement | null) => {
    dialogRef.current = node;
    if (!node || node.open) return;
    node.onclose = () => onCloseRef.current();
    node.onclick = (event) => {
      if (event.target === node) node.close();
    };
    node.showModal();
  }, []);
  return (
    <dialog
      ref={setDialog}
      className="lore-modal"
      aria-labelledby="lore-modal-title"
    >
      <button
        type="button"
        className="lore-modal-close"
        aria-label={showFooter ? "Close story" : "Close"}
        onClick={(event) => event.currentTarget.closest("dialog")?.close()}
      >
        ×
      </button>
      <Image
        src={note.image}
        alt={note.alt}
        width={720}
        height={720}
        sizes="(max-width: 640px) 92vw, 560px"
      />
      <p id={showFooter ? undefined : "lore-modal-title"}>{note.text}</p>
      {showFooter ? (
        <footer className="lore-modal-footer">
          <p id="lore-modal-title">
            {alert ? <NewsMark /> : null}
            {title}
          </p>
          <button
            type="button"
            className="lore-next"
            onClick={onNext}
            disabled={!canAdvance}
          >
            Next story
          </button>
        </footer>
      ) : null}
    </dialog>
  );
}
