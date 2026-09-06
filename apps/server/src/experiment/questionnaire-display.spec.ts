import { ParticipantRole } from '@prisma/client';
import { formalQuestionnaireTemplate } from '../questionnaire/three-chapter-v1-1';
import { ExperimentService } from './experiment.service';

function buildQuestionnaire(input: {
  condition: string;
  role: ParticipantRole;
  kind: 'segment_survey' | 'post_survey';
  workSegment: number | null;
  aiMessages?: unknown[];
  tasks?: unknown[];
}) {
  const service = new ExperimentService({} as never, {} as never);
  const session = {
    id: 'session-1',
    experimentCondition: input.condition,
    experimentSnapshot: { aiEnabled: !['A0', 'A7', 'A8'].includes(input.condition), experimentCondition: input.condition },
    tasks: input.tasks ?? [],
    aiMessages: input.aiMessages ?? [],
  };
  const template = { id: 'template-v3-0', title: 'V3.0', items: formalQuestionnaireTemplate };
  return (service as any).buildFormalQuestionnaire(session, template, input.kind, {
    mode: 'formal',
    role: input.role,
    participantId: 'participant-1',
    segmentIndex: input.workSegment === null ? 99 : input.workSegment * 2,
    workSegment: input.workSegment,
  });
}

describe('V3.0 questionnaire display logic', () => {
  it('hides segment AI items for A0 even when a legacy AI row exists', () => {
    const questionnaire = buildQuestionnaire({
      condition: 'A0',
      role: ParticipantRole.A,
      kind: 'segment_survey',
      workSegment: 1,
      aiMessages: [{ participantId: 'participant-1', contextType: 'main', phase: 'FORMAL', segmentIndex: 1, messageRole: 'user' }],
    });
    expect(questionnaire.displayedItemCodes).toHaveLength(6);
    expect(questionnaire.displayedItemCodes).not.toContain('SEG-AI-01');
  });

  it('shows segment AI items only when task 1 AI was used in that runtime work segment', () => {
    const questionnaire = buildQuestionnaire({
      condition: 'A1',
      role: ParticipantRole.A,
      kind: 'segment_survey',
      workSegment: 2,
      aiMessages: [{ participantId: 'participant-1', contextType: 'main', phase: 'FORMAL', segmentIndex: 3, messageRole: 'user' }],
    });
    expect(questionnaire.displayedItemCodes).toHaveLength(9);
    expect(questionnaire.displayedItemCodes).toContain('SEG-AI-03');
  });

  it('uses the A0 role-B wording and hides AI experience sections', () => {
    const questionnaire = buildQuestionnaire({ condition: 'A0', role: ParticipantRole.B, kind: 'post_survey', workSegment: null });
    expect(questionnaire.displayedItemCodes).toContain('POST-B-02A');
    expect(questionnaire.displayedItemCodes).not.toContain('POST-B-02B');
    expect(questionnaire.displayedItemCodes).not.toContain('POST-AI-01');
    expect(questionnaire.displayedItemCodes).not.toContain('POST-TECH-02');
    expect(questionnaire.displayedItemCodes).toContain('POST-AICHG-03B');
  });

  it.each(['A7', 'A8'])('treats new no-AI condition %s exactly as no AI in questionnaires', (condition) => {
    const questionnaire = buildQuestionnaire({ condition, role: ParticipantRole.B, kind: 'post_survey', workSegment: null });
    expect(questionnaire.displayedItemCodes).toContain('POST-B-02A');
    expect(questionnaire.displayedItemCodes).not.toContain('POST-AI-01');
    expect(questionnaire.displayedItemCodes).not.toContain('POST-TECH-02');
  });

  it('shows advanced image and behavior-dependent role-B items when supported by logs', () => {
    const questionnaire = buildQuestionnaire({
      condition: 'A2',
      role: ParticipantRole.B,
      kind: 'post_survey',
      workSegment: null,
      aiMessages: [{ participantId: 'participant-1', contextType: 'main', phase: 'FORMAL', segmentIndex: 1, messageRole: 'user', attachments: [{}] }],
      tasks: [{ aDraft: { handoffMemo: '请核验' }, bViewedAMaterialsAt: new Date(), bFeedbackDraft: { q1: '是' } }],
    });
    expect(questionnaire.displayedItemCodes).toEqual(expect.arrayContaining([
      'POST-AI-04', 'POST-B-03', 'POST-B-04', 'POST-B-05', 'MC1-03',
    ]));
    expect(questionnaire.displayedItemCodes).not.toContain('POST-B-02A');
  });

  it('places online implementation self-report after demographics and before payment', () => {
    const questionnaire = buildQuestionnaire({ condition: 'A0', role: ParticipantRole.A, kind: 'post_survey', workSegment: null });
    const codes = questionnaire.displayedItemCodes;
    expect(codes.indexOf('POST-INT-01')).toBeGreaterThan(codes.indexOf('DEMO-08'));
    expect(codes.indexOf('POST-INT-02')).toBeLessThan(codes.indexOf('POST-PAY-02'));
  });

  it('shows the abnormal-type follow-up only when POST-INT-01 is yes', () => {
    const service = new ExperimentService({} as never, {} as never);
    const item = formalQuestionnaireTemplate.postSurvey.commonSections
      .flatMap((section) => section.items)
      .find((candidate) => candidate.code === 'POST-INT-03');
    expect((service as any).questionnaireItemVisible(item, { 'POST-INT-01': '没有' })).toBe(false);
    expect((service as any).questionnaireItemVisible(item, { 'POST-INT-01': '有' })).toBe(true);
  });
});
