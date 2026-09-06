import { AuthService } from './auth.service';

describe('V0.4 instruction and side-task randomization', () => {
  const service = new AuthService({} as never, {} as never, {} as never);

  it('randomizes all three neutral instructions in formal mode and snapshots V2 IDs', () => {
    const seeds = { newsOrderSeed: 'news' };
    const plan = (service as any).buildInstructionPlan('formal', 'neutral_info', [], seeds);
    expect(plan.version).toBe('pre_segment_instruction_v2');
    expect(plan.orderType).toBe('neutral_order');
    expect(new Set(Object.values(plan.instructionTypes))).toEqual(new Set(['neutral_1', 'neutral_2', 'neutral_3']));
    expect(Object.values(plan.instructionTextIds).every((id) => String(id).endsWith('_V2'))).toBe(true);
    expect(seeds).toHaveProperty('instructionOrderSeed');
  });

  it('maps the three Chinese cooperation themes without falling back to one instruction', () => {
    const plan = (service as any).buildInstructionPlan(
      'formal',
      'coop_narrative',
      ['验证留痕', '共同责任', '互补分工'],
      { newsOrderSeed: 'news' },
    );
    expect(plan.orderValue).toBe('V_S_C');
    expect(Object.values(plan.instructionTypes)).toEqual(['verification_trace', 'shared_responsibility', 'complementarity']);
  });

  it('samples exactly four questions from each of the five subtypes', () => {
    const subtypes = ['C1_divided_information', 'C2_handoff_value', 'C3_integration', 'C4_complementary_roles', 'C5_redundancy_boundary'];
    const candidates = subtypes.flatMap((subtype) => Array.from({ length: 6 }, (_, index) => ({
      id: `${subtype}-${index}`,
      itemCode: `${subtype}-${index}`,
      narrativeSubtype: subtype,
    })));
    const sampled = (service as any).sampleBalancedCoopItems(candidates, '互补分工', 1, 'seed');
    expect(sampled).toHaveLength(20);
    for (const subtype of subtypes) {
      expect(sampled.filter((item: { itemCode: string }) => item.itemCode.startsWith(subtype)).length).toBe(4);
    }
  });
});
