import type { WorldResources } from "@/lib/world-resources";

function HealthStat({
  label,
  value,
  kind,
  description,
}: {
  label: string;
  value: number | string | null;
  kind: string;
  description?: string;
}) {
  return (
    <div className={`health-stat health-${kind}`} title={description}>
      <span className="resource-swatch" />
      <div>
        <dt>{label}</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthMosslings({
  value,
  killed,
}: {
  value: number | null;
  killed: number | null;
}) {
  return (
    <HealthStat
      label="Mosslings"
      kind="mosslings"
      value={value === null || killed === null ? null : `${value} / ${killed}`}
      description="Mosslings: alive / killed"
    />
  );
}
export function HealthFood({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Crops"
      kind="food"
      value={value}
      description="Ripe crop tiles. One fully grown tile feeds about one Mossling."
    />
  );
}
export function HealthTrees({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Trees"
      kind="trees"
      value={value}
      description="Living tree tiles on the map"
    />
  );
}
export function HealthStone({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Stone"
      kind="stone"
      value={value}
      description="Available stone: undamaged rock tiles"
    />
  );
}
export function HealthWater({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Water"
      kind="water"
      value={value}
      description="Available water: water tiles"
    />
  );
}
export function HealthVital({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Health"
      kind="vital"
      value={value === null ? null : `${value}/100`}
      description="Average health of living Mosslings. Hunger pulls this down when ripe fields run short."
    />
  );
}
export function Health({ resources }: { resources: WorldResources | null }) {
  return (
    <dl className="health panel" aria-label="World resources">
      <HealthMosslings
        value={resources?.mosslings ?? null}
        killed={resources?.killed ?? null}
      />
      <HealthFood value={resources?.food ?? null} />
      <HealthTrees value={resources?.trees ?? null} />
      <HealthStone value={resources?.stone ?? null} />
      <HealthWater value={resources?.water ?? null} />
      <HealthVital value={resources?.health ?? null} />
    </dl>
  );
}
