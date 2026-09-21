import type { GodAction, PowerId } from "../types";
import { disease } from "./disease";
import { fire } from "./fire";
import { ground } from "./ground";
import { grow } from "./grow";
import { lightning } from "./lightning";
import { meteor } from "./meteor";
import { quake } from "./quake";
import { rain } from "./rain";
import { raze } from "./raze";
import { tornado } from "./tornado";

export const GOD_ACTIONS: Record<PowerId, GodAction> = {
  rain,
  grow,
  ground,
  raze,
  disease,
  fire,
  tornado,
  quake,
  lightning,
  meteor,
};
