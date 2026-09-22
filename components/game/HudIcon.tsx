export function HudIcon({ src }: { src: string }) {
  return (
    // Pixel art is already 32×32. The image optimizer would resample it.
    // biome-ignore lint/performance/noImgElement: keep pixel edges crisp
    <img className="pixel-icon" src={src} alt="" />
  );
}
