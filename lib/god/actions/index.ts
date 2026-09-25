import type { GodAction, PowerId } from "../types";
import { disease } from "./disease";
import { fire } from "./fire";
import { lightning } from "./lightning";
import { meteor } from "./meteor";
import { nuke } from "./nuke";
import { rain } from "./rain";
import { raze } from "./raze";
import { sun } from "./sun";
import { tornado } from "./tornado";

export const GOD_ACTIONS: Record<PowerId, GodAction> = {
  rain,
  sun,
  raze,
  disease,
  fire,
  tornado,
  nuke,
  lightning,
  meteor,
};
