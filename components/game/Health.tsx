import type { WorldResources } from "@/lib/world-resources";
import { HudIcon } from "./HudIcon";

function HealthStat({
  label,
  value,
  icon,
  description,
}: {
  label: string;
  value: number | string | null;
  icon: string;
  description?: string;
}) {
  return (
    <div className="health-stat" title={description}>
      <HudIcon src={icon} />
      <div className="health-stat-text">
        <dt>{label}</dt>
        <dd>{value ?? "—"}</dd>
      </div>
    </div>
  );
}
export function HealthMosslings({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Mosslings"
      icon="/mosslings/icons/mossling.png"
      value={value}
      description="Living Mosslings"
    />
  );
}
export function HealthBorn({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Born"
      icon="/mosslings/icons/born.png"
      value={value}
      description="Mosslings born during play"
    />
  );
}
export function HealthDied({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Died"
      icon="/mosslings/icons/died.png"
      value={value}
      description="Mosslings that have died"
    />
  );
}
export function HealthDestroyed({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Destroyed"
      icon="/mosslings/icons/destroyed.png"
      value={value}
      description="Tiles damaged by disasters that have not fully recovered"
    />
  );
}
export function HealthFood({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Carrots"
      icon="/mosslings/icons/carrot.png"
      value={value}
      description="Available carrot food. One full summer carrot patch feeds about one Mossling."
    />
  );
}
export function HealthVital({ value }: { value: number | null }) {
  return (
    <HealthStat
      label="Health"
      icon="/mosslings/icons/heart.png"
      value={value === null ? null : `${value}/100`}
      description="Average health of living Mosslings. Hunger pulls this down when ripe fields run short."
    />
  );
}
export function Health({ resources }: { resources: WorldResources | null }) {
  return (
    <dl className="health panel" aria-label="World resources">
      <HealthMosslings value={resources?.mosslings ?? null} />
      <HealthBorn value={resources?.born ?? null} />
      <HealthDied value={resources?.killed ?? null} />
      <HealthDestroyed value={resources?.destroyed ?? null} />
      <HealthFood value={resources?.food ?? null} />
      <HealthVital value={resources?.health ?? null} />
    </dl>
  );
}
