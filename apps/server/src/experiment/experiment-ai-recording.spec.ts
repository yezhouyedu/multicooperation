import { AiLevel, ExperimentConfig } from '@prisma/client';
import { ExperimentService } from './experiment.service';

describe('ExperimentService AI recording policy', () => {
  const service = new ExperimentService({} as never, {} as never);
  const privateService = service as unknown as {
    getTaskAiLevel(
      config: ExperimentConfig,
      segmentIndex: number,
      session?: { experimentSnapshot: unknown },
    ): AiLevel | null;
  };
  const config = {
    segmentOneAiLevel: AiLevel.BASIC,
    segmentTwoAiLevel: AiLevel.BASIC,
    segmentThreeAiLevel: AiLevel.BASIC,
  } as ExperimentConfig;

  it('records no AI level for practice tasks', () => {
    expect(privateService.getTaskAiLevel(config, 0, {
      experimentSnapshot: { aiEnabled: true, aiCondition: 'ADVANCED' },
    })).toBeNull();
  });

  it('records no AI level for formal tasks in a no-AI condition', () => {
    expect(privateService.getTaskAiLevel(config, 1, {
      experimentSnapshot: { aiEnabled: false, aiCondition: 'NONE' },
    })).toBeNull();
  });

  it('records the frozen formal AI level for an AI-enabled condition', () => {
    expect(privateService.getTaskAiLevel(config, 1, {
      experimentSnapshot: {
        aiEnabled: true,
        aiCondition: 'ADVANCED',
        segmentAiStates: { '1': 'ADVANCED' },
      },
    })).toBe(AiLevel.ADVANCED);
  });
});
