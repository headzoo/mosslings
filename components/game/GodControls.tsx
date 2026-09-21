import type { PowerId } from "@/lib/god/types";
import { type IconName, PixelIcon } from "./PixelIcon";

type ControlsProps = {
  selected: PowerId | null;
  onSelect: (power: PowerId) => void;
  disabled: boolean;
};
function GodButton({
  name,
  icon,
  power,
  selected,
  onSelect,
  disabled,
}: ControlsProps & { name: string; icon: IconName; power: PowerId }) {
  return (
    <button
      type="button"
      className="god-button panel"
      aria-pressed={selected === power}
      disabled={disabled}
      title={`Place ${name}`}
      onClick={() => onSelect(power)}
    >
      <PixelIcon name={icon} />
      <span>{name}</span>
    </button>
  );
}
export function GodRain(props: ControlsProps) {
  return <GodButton {...props} name="Rain" icon="rain" power="rain" />;
}
export function GodGrow(props: ControlsProps) {
  return <GodButton {...props} name="Grow" icon="grow" power="grow" />;
}
export function GodGround(props: ControlsProps) {
  return <GodButton {...props} name="Ground" icon="ground" power="ground" />;
}
export function GodRaze(props: ControlsProps) {
  return <GodButton {...props} name="Raze" icon="raze" power="raze" />;
}
export function GodDisease(props: ControlsProps) {
  return <GodButton {...props} name="Disease" icon="skull" power="disease" />;
}
export function GodFire(props: ControlsProps) {
  return <GodButton {...props} name="Fire" icon="fire" power="fire" />;
}
export function GodTornado(props: ControlsProps) {
  return <GodButton {...props} name="Tornado" icon="tornado" power="tornado" />;
}
export function GodQuake(props: ControlsProps) {
  return <GodButton {...props} name="Quake" icon="quake" power="quake" />;
}
export function GodLightning(props: ControlsProps) {
  return (
    <GodButton {...props} name="Lightning" icon="lightning" power="lightning" />
  );
}
export function GodMeteor(props: ControlsProps) {
  return <GodButton {...props} name="Meteor" icon="meteor" power="meteor" />;
}
export function GodControls(props: ControlsProps) {
  return (
    <aside className="god-rail" aria-label="God powers">
      <div className="god-buttons">
        <GodRain {...props} />
        <GodGrow {...props} />
        <GodGround {...props} />
        <GodRaze {...props} />
        <GodDisease {...props} />
        <GodFire {...props} />
        <GodTornado {...props} />
        <GodQuake {...props} />
        <GodLightning {...props} />
        <GodMeteor {...props} />
      </div>
    </aside>
  );
}
