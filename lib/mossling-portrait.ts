import { plagueShade } from "./god/disease";
import { mosslingPatternColor, type PreviewMossling } from "./map-preview";
import { BOUNCE_SECONDS } from "./mossling-detail";

export const PORTRAIT_SIZE = 256;
export const PORTRAIT_FRAME_COUNT = 15;
/** Half the map hop speed, so the modal portrait reads as a slow bounce. */
export const PORTRAIT_BOUNCE_SECONDS = BOUNCE_SECONDS * 2;
/** Dark eyes and mouth stay uncolored. */
export const PORTRAIT_FACE_DARK = 35;
/** Eye glints stay uncolored. Light moss tufts sit below this. */
export const PORTRAIT_FACE_GLINT = 230;

let framesPromise: Promise<ImageData[]> | undefined;

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Shared by every Mossling with the same pattern, colors, and living/dead look. */
export function portraitLookKey(mossling: PreviewMossling): string {
  return [
    mossling.pattern,
    mossling.pattern === 4 ? mossling.id : "",
    mossling.colors.join("."),
    mossling.plagueMonths ?? "",
    (mossling.health ?? 100) <= 0 ? "dead" : "live",
  ].join("|");
}

/**
 * Frame 0..14. Neighboring ids are a frame apart so inspected Mosslings
 * do not bounce together. Pause freezes it. The dead stay on idle.
 */
export function portraitBounceFrame(
  id: number,
  elapsed: number,
  health = 100,
): number {
  if (health <= 0) return 0;
  const span = PORTRAIT_BOUNCE_SECONDS / PORTRAIT_FRAME_COUNT;
  const shifted = elapsed + id * span;
  const wrapped =
    ((shifted % PORTRAIT_BOUNCE_SECONDS) + PORTRAIT_BOUNCE_SECONDS) %
    PORTRAIT_BOUNCE_SECONDS;
  return Math.min(PORTRAIT_FRAME_COUNT - 1, Math.floor(wrapped / span));
}

/** Opaque silhouette of a grayscale frame, used to stick the 8×8 pattern to the body. */
export function opaqueBounds(image: ImageData): Bounds | null {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] < 128) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

// One neutral strip is decoded once, then every individual gets its own skin.
export function loadPortraitFrames(): Promise<ImageData[]> {
  if (!framesPromise) {
    framesPromise = new Promise<ImageData[]>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = PORTRAIT_SIZE;
        canvas.height = PORTRAIT_SIZE * PORTRAIT_FRAME_COUNT;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Portrait canvas unavailable"));
          return;
        }
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const frames: ImageData[] = [];
        for (let frame = 0; frame < PORTRAIT_FRAME_COUNT; frame++) {
          frames.push(
            context.getImageData(
              0,
              frame * PORTRAIT_SIZE,
              PORTRAIT_SIZE,
              PORTRAIT_SIZE,
            ),
          );
        }
        resolve(frames);
      };
      image.onerror = () =>
        reject(new Error("Could not load the Mossling portrait"));
      image.src = "/mosslings/portrait-bounce-v1.png";
    }).catch((error) => {
      framesPromise = undefined;
      throw error;
    });
  }
  return framesPromise;
}

let backdropPromise: Promise<HTMLImageElement> | undefined;

/** Woodland splash behind the bouncing portrait. Shared by every Mossling. */
export function loadPortraitBackdrop(): Promise<HTMLImageElement> {
  if (!backdropPromise) {
    backdropPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Could not load the portrait backdrop"));
      image.src = "/mosslings/portrait-backdrop-v1.png";
    }).catch((error) => {
      backdropPromise = undefined;
      throw error;
    });
  }
  return backdropPromise;
}

export function skinPortrait(
  base: ImageData,
  mossling: PreviewMossling,
): ImageData {
  const result = new ImageData(
    new Uint8ClampedArray(base.data),
    base.width,
    base.height,
  );
  const palette = new Map(
    mossling.colors.map((hex) => [
      hex,
      [
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16),
      ],
    ]),
  );
  const box = opaqueBounds(base);
  const boxW = box ? box.maxX - box.minX + 1 : base.width;
  const boxH = box ? box.maxY - box.minY + 1 : base.height;
  const originX = box?.minX ?? 0;
  const originY = box?.minY ?? 0;
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const offset = (y * base.width + x) * 4;
      const alpha = base.data[offset + 3] ?? 0;
      if (alpha === 0) continue;
      const months = mossling.plagueMonths;
      if ((mossling.health ?? 100) <= 0) {
        result.data[offset] = 17;
        result.data[offset + 1] = 17;
        result.data[offset + 2] = 17;
        continue;
      }
      const brightness =
        (base.data[offset] + base.data[offset + 1] + base.data[offset + 2]) / 3;
      if (brightness < PORTRAIT_FACE_DARK || brightness > PORTRAIT_FACE_GLINT)
        continue;
      const px = Math.min(
        7,
        Math.max(0, Math.floor(((x - originX) / boxW) * 8)),
      );
      const py = Math.min(
        7,
        Math.max(0, Math.floor(((y - originY) / boxH) * 8)),
      );
      const color = palette.get(mosslingPatternColor(mossling, px, py));
      if (!color) continue;
      const shade =
        Math.min(1.25, brightness / 155) *
        (months === undefined ? 1 : plagueShade(months));
      const tinted = color.map((channel) => Math.round(channel * shade));
      for (let channel = 0; channel < 3; channel++)
        result.data[offset + channel] = tinted[channel] ?? 0;
    }
  }
  return result;
}
