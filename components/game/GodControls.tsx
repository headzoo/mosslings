import type { Ref } from "react";
import type { PowerId } from "@/lib/god/types";
import { HudIcon } from "./HudIcon";

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
}: ControlsProps & { name: string; icon: string; power: PowerId }) {
  return (
    <button
      type="button"
      className="god-button panel"
      aria-pressed={selected === power}
      disabled={disabled}
      title={`Place ${name}`}
      onClick={() => onSelect(power)}
    >
      <HudIcon src={icon} />
      <span>{name}</span>
    </button>
  );
}
export function GodRain(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Rain"
      icon="/mosslings/icons/rain.png"
      power="rain"
    />
  );
}
export function GodSun(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Sun"
      icon="/mosslings/icons/sun.png"
      power="sun"
    />
  );
}
export function GodRaze(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Carrots"
      icon="/mosslings/icons/carrot.png"
      power="raze"
    />
  );
}
export function GodDisease(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Disease"
      icon="/mosslings/icons/virus.png"
      power="disease"
    />
  );
}
export function GodFire(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Fire"
      icon="/mosslings/icons/fire.png"
      power="fire"
    />
  );
}
export function GodTornado(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Tornado"
      icon="/mosslings/icons/tornado.png"
      power="tornado"
    />
  );
}
export function GodNuke(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Nuke"
      icon="/mosslings/icons/nuke.png"
      power="nuke"
    />
  );
}
export function GodLightning(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Lightning"
      icon="/mosslings/icons/lightning.png"
      power="lightning"
    />
  );
}
export function GodMeteor(props: ControlsProps) {
  return (
    <GodButton
      {...props}
      name="Meteor"
      icon="/mosslings/icons/meteor.png"
      power="meteor"
    />
  );
}
export function GodControls({
  ref,
  highlighted = false,
  ...props
}: ControlsProps & {
  ref?: Ref<HTMLElement>;
  highlighted?: boolean;
}) {
  return (
    <aside
      ref={ref}
      className={`god-rail${highlighted ? " god-rail--intro-highlight" : ""}`}
      aria-label="God powers"
    >
      <div className="god-buttons">
        <GodRain {...props} />
        <GodSun {...props} />
        <GodRaze {...props} />
        <GodDisease {...props} />
        <GodFire {...props} />
        <GodTornado {...props} />
        <GodNuke {...props} />
        <GodLightning {...props} />
        <GodMeteor {...props} />
      </div>
    </aside>
  );
}
