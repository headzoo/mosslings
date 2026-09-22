import type { WorldResources } from "./world-resources";

export const SAMPLES_PER_YEAR = 12;

export interface ResourceHistorySample {
  born: number;
  mosslings: number;
  food: number;
  killed: number;
  destroyed: number;
  health: number;
}

export class ResourceHistory {
  private samples: ResourceHistorySample[] = [];

  static empty(): ResourceHistory {
    return new ResourceHistory();
  }

  record(sample: ResourceHistorySample): void {
    this.samples.push(sample);
    if (this.samples.length > SAMPLES_PER_YEAR) this.samples.shift();
  }

  values(): ResourceHistorySample[] {
    return [...this.samples];
  }
}

export function sampleFromResources(
  resources: WorldResources,
): ResourceHistorySample {
  return {
    born: resources.born,
    mosslings: resources.mosslings,
    food: resources.food,
    killed: resources.killed,
    destroyed: resources.destroyed,
    health: resources.health,
  };
}
