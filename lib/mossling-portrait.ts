import { plagueShade } from "./god/disease";
import {
  mosslingPatternColor,
  type PreviewMossling,
  pulseRgb,
} from "./map-preview";

export const PORTRAIT_SIZE = 64;
let basePromise: Promise<ImageData> | undefined;

// One neutral asset is decoded once, then every individual gets its own skin.
export function loadPortraitBase(): Promise<ImageData> {
  if (!basePromise) {
    basePromise = new Promise<ImageData>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = PORTRAIT_SIZE;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Portrait canvas unavailable"));
          return;
        }
        context.imageSmoothingEnabled = false;
        context.drawImage(image, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);
        resolve(context.getImageData(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE));
      };
      image.onerror = () =>
        reject(new Error("Could not load the Mossling portrait"));
      image.src = "/mosslings/portrait-base-v1.png";
    }).catch((error) => {
      basePromise = undefined;
      throw error;
    });
  }
  return basePromise;
}

// Face regions belong to this version of the base asset. Keep the eyes,
// their glints, and the mouth separate from the body's inherited markings.
function isFace(x: number, y: number): boolean {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  return (
    ellipse(0.525, 0.553, 0.047, 0.049) ||
    ellipse(0.769, 0.508, 0.047, 0.049) ||
    ellipse(0.663, 0.558, 0.033, 0.026)
  );
}

export function skinPortrait(
  base: ImageData,
  mossling: PreviewMossling,
  elapsed = 0,
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
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const offset = (y * base.width + x) * 4;
      if (base.data[offset + 3] < 128) {
        result.data[offset + 3] = 0;
        continue;
      }
      const months = mossling.plagueMonths;
      if ((mossling.health ?? 100) <= 0) {
        result.data[offset] = 17;
        result.data[offset + 1] = 17;
        result.data[offset + 2] = 17;
        continue;
      }
      const brightness =
        (base.data[offset] + base.data[offset + 1] + base.data[offset + 2]) / 3;
      if (brightness < 35 || isFace(x / base.width, y / base.height)) continue;
      // Project the same 8x8 pattern used by the board across the body.
      const px = Math.min(
        7,
        Math.max(0, Math.floor(((x / base.width - 0.09) / 0.82) * 8)),
      );
      const py = Math.min(
        7,
        Math.max(0, Math.floor(((y / base.height - 0.13) / 0.75) * 8)),
      );
      const color = palette.get(mosslingPatternColor(mossling, px, py));
      if (!color) continue;
      const shade =
        Math.min(1.25, brightness / 155) *
        (months === undefined ? 1 : plagueShade(months));
      const tinted = color.map((channel) => Math.round(channel * shade));
      const pulsed =
        months === undefined ? pulseRgb(tinted, mossling, elapsed) : tinted;
      for (let channel = 0; channel < 3; channel++)
        result.data[offset + channel] = pulsed[channel] ?? 0;
    }
  }
  return result;
}
