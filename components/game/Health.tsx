import type { ResourceHistorySample } from "@/lib/resource-history";
import type { WorldResources } from "@/lib/world-resources";
import { Sparkline } from "./Sparkline";

function HealthStat({
  label,
  value,
  kind,
  description,
  sparkline,
  sparklineLabel,
}: {
  label: string;
  value: number | string | null;
  kind: string;
  description?: string;
  sparkline: number[];
  sparklineLabel: string;
}) {
  return (
    <div className={`health-stat health-${kind}`} title={description}>
      <div className="health-stat-head">
        <span className="resource-swatch" />
        <div className="health-stat-text">
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      </div>
      <Sparkline values={sparkline} label={sparklineLabel} />
    </div>
  );
}
export function HealthBorn({
  value,
  sparkline,
}: {
  value: number | null;
  sparkline: number[];
}) {
  return (
    <HealthStat
      label="Born"
      kind="born"
      value={value}
      description="Mosslings born during play"
      sparkline={sparkline}
      sparklineLabel="Mosslings born over the last year"
    />
  );
}
export function HealthMosslings({
  value,
  sparkline,
}: {
  value: number | null;
  sparkline: number[];
}) {
  return (
    <HealthStat
      label="Mosslings"
      kind="mosslings"
      value={value}
      description="Living Mosslings"
      sparkline={sparkline}
      sparklineLabel="Mosslings alive over the last year"
    />
  );
}
export function HealthFood({
  value,
  sparkline,
}: {
  value: number | null;
  sparkline: number[];
}) {
  return (
    <HealthStat
      label="Crops"
      kind="food"
      value={value}
      description="Available crop food. One full summer tile feeds about one Mossling."
      sparkline={sparkline}
      sparklineLabel="Crop food over the last year"
    />
  );
}
export function HealthDied({
  value,
  sparkline,
}: {
  value: number | null;
  sparkline: number[];
}) {
  return (
    <HealthStat
      label="Died"
      kind="died"
      value={value}
      description="Mosslings that have died"
      sparkline={sparkline}
      sparklineLabel="Mosslings died over the last year"
    />
  );
}
export function HealthDestroyed({
  value,
  sparkline,
}: {
  value: number | null;
  sparkline: number[];
}) {
  return (
    <HealthStat
      label="Destroyed"
      kind="destroyed"
      value={value}
      description="Tiles damaged by disasters that have not fully recovered"
      sparkline={sparkline}
      sparklineLabel="Destroyed tiles over the last year"
    />
  );
}
export function HealthVital({
  value,
  sparkline,
}: {
  value: number | null;
  sparkline: number[];
}) {
  return (
    <HealthStat
      label="Health"
      kind="vital"
      value={value === null ? null : `${value}/100`}
      description="Average health of living Mosslings. Hunger pulls this down when ripe fields run short."
      sparkline={sparkline}
      sparklineLabel="Average Mossling health over the last year"
    />
  );
}
function series(
  history: ResourceHistorySample[] | null,
  key: keyof ResourceHistorySample,
): number[] {
  return history?.map((sample) => sample[key]) ?? [];
}
export function Health({
  resources,
  history,
}: {
  resources: WorldResources | null;
  history: ResourceHistorySample[] | null;
}) {
  return (
    <dl className="health panel" aria-label="World resources">
      <HealthMosslings
        value={resources?.mosslings ?? null}
        sparkline={series(history, "mosslings")}
      />
      <HealthBorn
        value={resources?.born ?? null}
        sparkline={series(history, "born")}
      />
      <HealthDied
        value={resources?.killed ?? null}
        sparkline={series(history, "killed")}
      />
      <HealthDestroyed
        value={resources?.destroyed ?? null}
        sparkline={series(history, "destroyed")}
      />
      <HealthFood
        value={resources?.food ?? null}
        sparkline={series(history, "food")}
      />
      <HealthVital
        value={resources?.health ?? null}
        sparkline={series(history, "health")}
      />
    </dl>
  );
}
