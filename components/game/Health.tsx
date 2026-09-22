"use client";

import type { CSSProperties } from "react";
import { MONTH_SECONDS } from "@/lib/game-time";
import type { WorldResources } from "@/lib/world-resources";
import { BornStatIcon } from "./BornStatIcon";
import { CarrotStatIcon } from "./CarrotStatIcon";
import { DestroyedStatIcon, type DisasterId } from "./DestroyedStatIcon";
import { DiedStatIcon } from "./DiedStatIcon";
import { HudIcon } from "./HudIcon";
import { MosslingStatIcon } from "./MosslingStatIcon";
import { useDiedStatQueue } from "./useDiedStatQueue";

function HealthHeartbeat({
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
      className="health-heartbeat"
      data-playing={isPlaying}
      style={heartbeatStyle}
      aria-hidden="true"
    >
      <HudIcon src="/mosslings/icons/heart.png" />
    </div>
  );
}

export function HealthMosslings({
  value,
  elapsed = () => 0,
}: {
  value: number | null;
  elapsed?: () => number;
}) {
  return (
    <div className="health-stat" title="Living Mosslings">
      <MosslingStatIcon elapsed={elapsed} />
      <div className="health-stat-text">
        <dt>Mosslings</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthBorn({
  value,
  elapsed = () => 0,
}: {
  value: number | null;
  elapsed?: () => number;
}) {
  return (
    <div className="health-stat" title="Mosslings born during play">
      <BornStatIcon elapsed={elapsed} />
      <div className="health-stat-text">
        <dt>Born</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthDied({
  value,
  elapsed = () => 0,
}: {
  value: number | null;
  elapsed?: () => number;
}) {
  const { displayedCount, spriteFrame } = useDiedStatQueue(value, elapsed);
  return (
    <div className="health-stat" title="Mosslings that have died">
      <DiedStatIcon spriteFrame={spriteFrame} />
      <div className="health-stat-text">
        <dt>Died</dt>
        <dd>{displayedCount ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthDestroyed({
  value,
  activeDisaster = null,
  elapsed = () => 0,
}: {
  value: number | null;
  activeDisaster?: DisasterId | null;
  elapsed?: () => number;
}) {
  return (
    <div
      className="health-stat"
      title="Tiles damaged by disasters that have not fully recovered"
    >
      <DestroyedStatIcon activeDisaster={activeDisaster} elapsed={elapsed} />
      <div className="health-stat-text">
        <dt>Destroyed</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthFood({
  value,
  elapsed = () => 0,
}: {
  value: number | null;
  elapsed?: () => number;
}) {
  return (
    <div
      className="health-stat"
      title="Available carrot food. One full summer carrot patch feeds about one Mossling."
    >
      <CarrotStatIcon value={value} elapsed={elapsed} />
      <div className="health-stat-text">
        <dt>Carrots</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthVital({
  value,
  rate = 1,
  isPlaying = true,
}: {
  value: number | null;
  rate?: number;
  isPlaying?: boolean;
}) {
  return (
    <div
      className="health-stat"
      title="Average health of living Mosslings. Hunger pulls this down when ripe fields run short."
    >
      <HealthHeartbeat rate={rate} isPlaying={isPlaying} />
      <div className="health-stat-text">
        <dt>Health</dt>
        <dd>{value === null ? null : `${value}/100`}</dd>
      </div>
    </div>
  );
}
export function Health({
  resources,
  rate = 1,
  isPlaying = true,
  elapsed = () => 0,
  activeDisaster = null,
}: {
  resources: WorldResources | null;
  rate?: number;
  isPlaying?: boolean;
  elapsed?: () => number;
  activeDisaster?: DisasterId | null;
}) {
  return (
    <dl className="health panel" aria-label="World resources">
      <HealthMosslings value={resources?.mosslings ?? null} elapsed={elapsed} />
      <HealthBorn value={resources?.born ?? null} elapsed={elapsed} />
      <HealthDied value={resources?.killed ?? null} elapsed={elapsed} />
      <HealthDestroyed
        value={resources?.destroyed ?? null}
        activeDisaster={activeDisaster}
        elapsed={elapsed}
      />
      <HealthFood value={resources?.food ?? null} elapsed={elapsed} />
      <HealthVital
        value={resources?.health ?? null}
        rate={rate}
        isPlaying={isPlaying}
      />
    </dl>
  );
}
