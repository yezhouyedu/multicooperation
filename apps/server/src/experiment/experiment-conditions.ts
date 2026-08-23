import { createHash, randomBytes } from 'crypto';

export const EXPERIMENT_CONDITIONS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8'] as const;

export type ExperimentCondition = (typeof EXPERIMENT_CONDITIONS)[number];
export type ExperimentAiCondition = 'NONE' | 'BASIC' | 'ADVANCED';
export type SideDispatchMode = 'continuous' | 'batch';
export type NarrativeGroup = 'neutral_info' | 'coop_narrative';

export type ExperimentConditionDefinition = {
  condition: ExperimentCondition;
  aiEnabled: boolean;
  aiCondition: ExperimentAiCondition;
  sideDispatchMode: SideDispatchMode;
  narrativeGroup: NarrativeGroup;
};

export const EXPERIMENT_CONDITION_DEFINITIONS: Record<ExperimentCondition, ExperimentConditionDefinition> = {
  A0: { condition: 'A0', aiEnabled: false, aiCondition: 'NONE', sideDispatchMode: 'continuous', narrativeGroup: 'neutral_info' },
  A1: { condition: 'A1', aiEnabled: true, aiCondition: 'BASIC', sideDispatchMode: 'continuous', narrativeGroup: 'neutral_info' },
  A2: { condition: 'A2', aiEnabled: true, aiCondition: 'ADVANCED', sideDispatchMode: 'continuous', narrativeGroup: 'neutral_info' },
  A3: { condition: 'A3', aiEnabled: true, aiCondition: 'BASIC', sideDispatchMode: 'batch', narrativeGroup: 'neutral_info' },
  A4: { condition: 'A4', aiEnabled: true, aiCondition: 'BASIC', sideDispatchMode: 'continuous', narrativeGroup: 'coop_narrative' },
  A5: { condition: 'A5', aiEnabled: true, aiCondition: 'ADVANCED', sideDispatchMode: 'continuous', narrativeGroup: 'coop_narrative' },
  A6: { condition: 'A6', aiEnabled: true, aiCondition: 'ADVANCED', sideDispatchMode: 'batch', narrativeGroup: 'neutral_info' },
  A7: { condition: 'A7', aiEnabled: false, aiCondition: 'NONE', sideDispatchMode: 'batch', narrativeGroup: 'neutral_info' },
  A8: { condition: 'A8', aiEnabled: false, aiCondition: 'NONE', sideDispatchMode: 'continuous', narrativeGroup: 'coop_narrative' },
};

export function isExperimentCondition(value: unknown): value is ExperimentCondition {
  return EXPERIMENT_CONDITIONS.includes(value as ExperimentCondition);
}

export function experimentConditionDefinition(condition: ExperimentCondition) {
  return EXPERIMENT_CONDITION_DEFINITIONS[condition];
}

export function generateExperimentSeed() {
  return randomBytes(16).toString('hex');
}

export function experimentBlockSeed(masterSeed: string, blockIndex: number) {
  return createHash('sha256').update(`${masterSeed}:block:${blockIndex}`).digest('hex');
}

export function generateExperimentBlock(masterSeed: string, blockIndex: number): ExperimentCondition[] {
  const seed = experimentBlockSeed(masterSeed, blockIndex);
  const values = [...EXPERIMENT_CONDITIONS];
  let state = Number.parseInt(seed.slice(0, 8), 16) || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}
