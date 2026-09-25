import { useState } from "react";
import type { Season } from "@/lib/game-time";
import { HelpModal } from "./HelpModal";
import { HudIcon } from "./HudIcon";
import { SeasonSun } from "./SeasonSun";
import { YearClock } from "./YearClock";

const SEASON_SUN: Record<Season, string> = {
  Summer: "/mosslings/icons/sun.png",
  Spring: "/mosslings/icons/sun-spring.png",
  Autumn: "/mosslings/icons/sun-autumn.png",
  Winter: "/mosslings/icons/sun-winter.png",
};

export function seasonSunIcon(season: Season): string {
  return SEASON_SUN[season];
}
export function Year({
  year = 1,
  season = "Summer",
  elapsed = () => 0,
}: {
  year?: number;
  season?: Season;
  elapsed?: () => number;
}) {
  return (
    <div className="year panel">
      <SeasonSun season={season} elapsed={elapsed} />
      <div className="year-date">
        <span>Year {year}</span>
        <span>{season}</span>
      </div>
      <YearClock elapsed={elapsed} />
    </div>
  );
}
export function PlayShot({ onScreenshot }: { onScreenshot?: () => void }) {
  return (
    <button
      type="button"
      className="panel"
      aria-label="Take a screenshot"
      title="Take a screenshot"
      disabled={!onScreenshot}
      onClick={onScreenshot}
    >
      <HudIcon src="/mosslings/icons/camera.png" />
    </button>
  );
}
export function PlayMute({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="panel"
      aria-label={muted ? "Unmute music" : "Mute music"}
      aria-pressed={muted}
      title={muted ? "Unmute music" : "Mute music"}
      onClick={onToggle}
    >
      <HudIcon
        src={
          muted ? "/mosslings/icons/muted.png" : "/mosslings/icons/speaker.png"
        }
      />
    </button>
  );
}
export function PlayPause({
  isPlaying,
  onToggle,
}: {
  isPlaying: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="panel"
      aria-label={isPlaying ? "Pause" : "Play"}
      title={isPlaying ? "Pause" : "Play at normal speed"}
      onClick={onToggle}
    >
      <HudIcon
        src={
          isPlaying ? "/mosslings/icons/pause.png" : "/mosslings/icons/play.png"
        }
      />
    </button>
  );
}
export function PlaySkip({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      className="panel"
      aria-label="Skip to next spring"
      title="Skip to next spring"
      onClick={onSkip}
    >
      <HudIcon src="/mosslings/icons/skip.png" />
    </button>
  );
}
export function PlayFast({
  rate,
  onFastForward,
}: {
  rate: number;
  onFastForward: () => void;
}) {
  const nextRate = rate === 3 ? 1 : rate + 1 / 8;
  return (
    <button
      type="button"
      className="panel"
      aria-label={`Fast forward, currently ${rate} times speed`}
      aria-pressed={rate > 1}
      title={`Fast forward to ${nextRate}× speed`}
      onClick={onFastForward}
    >
      <HudIcon src="/mosslings/icons/fast.png" />
    </button>
  );
}
export function PlayControls({
  isPlaying,
  rate,
  muted,
  onToggleMute,
  onToggle,
  onSkip,
  onFastForward,
  onRestoreWelcome,
  onScreenshot,
}: {
  isPlaying: boolean;
  rate: number;
  muted: boolean;
  onToggleMute: () => void;
  onToggle: () => void;
  onSkip: () => void;
  onFastForward: () => void;
  onRestoreWelcome: () => void;
  onScreenshot?: () => void;
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  return (
    <fieldset className="play-controls" aria-label="Playback and help">
      <button
        type="button"
        className="panel"
        aria-label="Help"
        title="Help"
        onClick={() => setHelpOpen(true)}
      >
        <HudIcon src="/mosslings/icons/help.png" />
      </button>
      <PlayShot onScreenshot={onScreenshot} />
      <PlayMute muted={muted} onToggle={onToggleMute} />
      <PlayPause isPlaying={isPlaying} onToggle={onToggle} />
      <PlaySkip onSkip={onSkip} />
      <PlayFast rate={rate} onFastForward={onFastForward} />
      {helpOpen && (
        <HelpModal
          onDismiss={() => setHelpOpen(false)}
          onRestoreWelcome={() => {
            setHelpOpen(false);
            onRestoreWelcome();
          }}
        />
      )}
    </fieldset>
  );
}
