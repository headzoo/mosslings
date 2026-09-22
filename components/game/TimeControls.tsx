import { type CSSProperties, useState } from "react";
import { MONTH_SECONDS, type Season } from "@/lib/game-time";
import { HelpModal } from "./HelpModal";
import { PixelIcon, seasonSunIcon } from "./PixelIcon";
import { useMusic } from "./useMusic";
export function CalendarHeartbeat({
  rate = 1,
  isPlaying = true,
}: {
  rate?: number;
  isPlaying?: boolean;
}) {
  const heartbeatStyle = {
    "--heartbeat-duration": `${MONTH_SECONDS / rate}s`,
  } as CSSProperties;
  return (
    <div
      className="calendar-heartbeat"
      data-playing={isPlaying}
      style={heartbeatStyle}
      aria-hidden="true"
    >
      <PixelIcon name="heart" />
    </div>
  );
}
export function Year({
  year = 1,
  season = "Summer",
  rate = 1,
  isPlaying = true,
}: {
  year?: number;
  season?: Season;
  rate?: number;
  isPlaying?: boolean;
}) {
  return (
    <div className="year panel">
      <PixelIcon name={seasonSunIcon(season)} />
      <div className="year-date">
        <span>Year {year}</span>
        <span>{season}</span>
      </div>
      <CalendarHeartbeat rate={rate} isPlaying={isPlaying} />
    </div>
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
      <PixelIcon name={muted ? "muted" : "speaker"} />
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
      <PixelIcon name={isPlaying ? "pause" : "play"} />
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
      <PixelIcon name="skip" />
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
      <PixelIcon name="fast" />
    </button>
  );
}
export function PlayControls({
  isPlaying,
  rate,
  onToggle,
  onSkip,
  onFastForward,
  onRestoreWelcome,
}: {
  isPlaying: boolean;
  rate: number;
  onToggle: () => void;
  onSkip: () => void;
  onFastForward: () => void;
  onRestoreWelcome: () => void;
}) {
  const music = useMusic();
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
        <PixelIcon name="help" />
      </button>
      <PlayMute muted={music.muted} onToggle={music.toggleMuted} />
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
