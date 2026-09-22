import type { PreviewMossling } from "./map-preview";
import {
  loadPortraitBackdrop,
  loadPortraitFrames,
  PORTRAIT_SIZE,
  skinPortrait,
} from "./mossling-portrait";

/** X refuses card images over 5 MB. */
export const SHOT_BYTE_LIMIT = 5_000_000;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** v4 ids only, so a share path cannot escape `shots/`. */
const SHOT_ID =
  /^(map|portrait)_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ShotKind = "map" | "portrait";

export const MAP_SHARE_TEXT = "A little world of Mosslings";

export function portraitShareText(speciesName?: string): string {
  const name = speciesName?.trim();
  return name ? `Meet a ${name}` : "Meet a Mossling";
}

export function isShotId(id: string): boolean {
  return SHOT_ID.test(id);
}

export function shotKind(id: string): ShotKind | null {
  if (!isShotId(id)) return null;
  return id.startsWith("portrait_") ? "portrait" : "map";
}

export function shotPath(id: string): string {
  if (!isShotId(id)) throw new Error("Invalid screenshot id");
  return `shots/${id}.png`;
}

export function shotTitle(id: string): string {
  return shotKind(id) === "portrait" ? "Meet a Mossling" : MAP_SHARE_TEXT;
}

export function shotCard(id: string): "summary" | "summary_large_image" {
  return shotKind(id) === "portrait" ? "summary" : "summary_large_image";
}

export function newShotId(kind: ShotKind): string {
  return `${kind}_${crypto.randomUUID()}`;
}

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export function withinShotLimit(bytes: number): boolean {
  return bytes > PNG_SIGNATURE.length && bytes <= SHOT_BYTE_LIMIT;
}

/** Tweet body. The image URL is in the text, so X does not need a card. */
export function shotTweet(siteUrl: string, imageUrl: string): string {
  return `Playing with Mosslings at ${siteUrl}\n\n${imageUrl}`;
}

export function intentPostUrl(text: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text })}`;
}

export function shareChoice(canShareFile: boolean): "file" | "card" {
  return canShareFile ? "file" : "card";
}

export function canShareImageFile(
  file: File,
  canShare?: (data?: ShareData) => boolean,
): boolean {
  if (!canShare) return false;
  try {
    return canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the screenshot"));
    }, "image/png");
  });
}

/** Visible world layers inside the board, clipped to the viewport. */
export function captureViewport(viewport: HTMLElement): HTMLCanvasElement {
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  if (rect.width < 2 || rect.height < 2) {
    throw new Error("The map isn't ready to capture yet.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Screenshot canvas unavailable");
  context.imageSmoothingEnabled = false;
  const sources = viewport.querySelectorAll("canvas");
  for (const source of sources) {
    if (source.closest("dialog")) continue;
    if (source.width === 0 || source.height === 0) continue;
    const box = source.getBoundingClientRect();
    context.drawImage(
      source,
      box.left - rect.left,
      box.top - rect.top,
      box.width,
      box.height,
    );
  }
  const dim = viewport.querySelector(".season-dim");
  if (dim instanceof HTMLElement) {
    const opacity = Number(getComputedStyle(dim).opacity);
    if (opacity > 0) {
      context.fillStyle = `rgba(7, 21, 16, ${opacity})`;
      context.fillRect(0, 0, width, height);
    }
  }
  return canvas;
}

/** Backdrop plus bounce frame 0, at the portrait's native size. */
export async function capturePortrait(
  mossling: PreviewMossling,
): Promise<Blob> {
  const [frames, backdrop] = await Promise.all([
    loadPortraitFrames(),
    loadPortraitBackdrop().catch(() => null),
  ]);
  const frame = frames[0];
  if (!frame) throw new Error("Portrait frame unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = PORTRAIT_SIZE;
  canvas.height = PORTRAIT_SIZE;
  const context = canvas.getContext("2d");
  const sprite = document.createElement("canvas");
  sprite.width = PORTRAIT_SIZE;
  sprite.height = PORTRAIT_SIZE;
  const spriteContext = sprite.getContext("2d");
  if (!context || !spriteContext)
    throw new Error("Portrait canvas unavailable");
  spriteContext.putImageData(skinPortrait(frame, mossling), 0, 0);
  context.imageSmoothingEnabled = false;
  if (backdrop) {
    context.drawImage(backdrop, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
  }
  context.drawImage(sprite, 0, 0);
  return canvasToPng(canvas);
}

export function downloadPng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type PublishResult =
  | { status: "shared" | "cancelled" }
  | { status: "ready"; href: string };

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Hands the PNG to the system share sheet when the browser accepts files.
 * Otherwise uploads it and returns an X composer link whose text includes
 * the image URL. The link is opened by the player, not by a scripted tab.
 */
export async function publishShot(input: {
  blob: Blob;
  filename: string;
  kind: ShotKind;
}): Promise<PublishResult> {
  const siteUrl = window.location.origin;
  const file = new File([input.blob], input.filename, { type: "image/png" });
  if (
    shareChoice(
      canShareImageFile(file, navigator.canShare?.bind(navigator)),
    ) === "file"
  ) {
    try {
      await navigator.share({
        files: [file],
        text: `Playing with Mosslings at ${siteUrl}`,
      });
      return { status: "shared" };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { status: "cancelled" };
      }
    }
  }

  let imageUrl: string | null;
  try {
    const response = await fetch(`/api/shots?kind=${input.kind}`, {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: input.blob,
    });
    const payload = (await response.json().catch(() => null)) as {
      imageUrl?: string;
      error?: string;
    } | null;
    imageUrl = httpUrl(payload?.imageUrl);
    if (!response.ok || !imageUrl) {
      throw new Error(payload?.error ?? "The screenshot couldn't be uploaded.");
    }
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("The screenshot couldn't be uploaded.");
  }

  return {
    status: "ready",
    href: intentPostUrl(shotTweet(siteUrl, imageUrl)),
  };
}
