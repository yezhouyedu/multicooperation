import {
  EXPERIMENT_CONDITIONS,
  experimentConditionDefinition,
  generateExperimentBlock,
} from './experiment-conditions';

describe('experiment conditions', () => {
  it.each([
    ['A0', 'NONE', 'continuous', 'neutral_info'],
    ['A1', 'BASIC', 'continuous', 'neutral_info'],
    ['A2', 'ADVANCED', 'continuous', 'neutral_info'],
    ['A3', 'BASIC', 'batch', 'neutral_info'],
    ['A4', 'BASIC', 'continuous', 'coop_narrative'],
    ['A5', 'ADVANCED', 'continuous', 'coop_narrative'],
    ['A6', 'ADVANCED', 'batch', 'neutral_info'],
    ['A7', 'NONE', 'batch', 'neutral_info'],
    ['A8', 'NONE', 'continuous', 'coop_narrative'],
  ] as const)('maps %s to its fixed treatment', (condition, ai, dispatch, narrative) => {
    expect(experimentConditionDefinition(condition)).toMatchObject({
      aiCondition: ai,
      sideDispatchMode: dispatch,
      narrativeGroup: narrative,
    });
  });

  it('generates deterministic balanced blocks', () => {
    const first = generateExperimentBlock('master-seed', 1);
    expect(first).toEqual(generateExperimentBlock('master-seed', 1));
    expect([...first].sort()).toEqual([...EXPERIMENT_CONDITIONS]);
  });

  it('keeps every generated block balanced', () => {
    for (let blockIndex = 1; blockIndex <= 1000; blockIndex += 1) {
      expect([...generateExperimentBlock('master-seed', blockIndex)].sort()).toEqual([...EXPERIMENT_CONDITIONS]);
    }
  });
});
