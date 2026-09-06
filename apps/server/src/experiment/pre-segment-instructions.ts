export type PreSegmentInstructionType =
  | 'neutral_1'
  | 'neutral_2'
  | 'neutral_3'
  | 'complementarity'
  | 'verification_trace'
  | 'shared_responsibility';

export type PreSegmentInstructionPlan = {
  version: string;
  durationSeconds: number;
  orderType: string;
  orderValue: string;
  instructionTypes: Record<string, PreSegmentInstructionType>;
  instructionTextIds: Record<string, string>;
  instructionFamilies: Record<string, 'neutral' | 'coop'>;
};

export const PRE_SEGMENT_INSTRUCTION_TEXTS: Record<
  PreSegmentInstructionType,
  { id: string; family: 'neutral' | 'coop'; body: string }
> = {
  neutral_1: {
    id: 'INSTR_NEUTRAL_1_V2',
    family: 'neutral',
    body: '某机构进行系统迁移时，新旧两个资料入口曾并行了一段时间。一些新文件已经进入统一平台，另一些历史材料仍留在旧页面，结果同类文件一度分散在不同位置。迁移完成后，旧入口陆续关闭，报告、表格和系统记录重新归入统一目录，原有文件本身未作内容改写。',
  },
  neutral_2: {
    id: 'INSTR_NEUTRAL_2_V2',
    family: 'neutral',
    body: '某机构更新业务记录工具后，原来以文字为主的一类材料开始同时出现表格、图片附件和系统导出记录。过渡期里，不同版式并存，一些页面的字段位置也不完全相同。后来，这些材料被纳入统一业务模板，各类材料仍按适合的形式呈现，变化主要集中在版式和字段位置。',
  },
  neutral_3: {
    id: 'INSTR_NEUTRAL_3_V2',
    family: 'neutral',
    body: '某机构在一次内部页面改版后，新旧两套分类标签同时出现：新文件开始采用新的名称，历史文件仍留在原有目录，一段时间内同类材料分布在不同分类下。随后，机构逐步迁移旧文件并统一标签。调整完成后，同类文件使用统一标签和目录层级，历史材料原有记录继续保留。',
  },
  complementarity: {
    id: 'INSTR_COMPLEMENTARITY_V2',
    family: 'coop',
    body: '某团队在一轮连续材料处理中遇到过一种情况：前一环节很快完成了整理，后续判断却仍漏掉了一条有用线索。复盘发现，问题不在材料缺失，而在这条线索没有被下一环节结合。此后团队更关注环节之间的信息衔接；不过，并不是前一环节的所有内容都会改变最终结果。',
  },
  verification_trace: {
    id: 'INSTR_VERIFICATION_TRACE_V2',
    family: 'coop',
    body: '某部门在一次流程复盘中碰到一份“看起来很完整”的结论，却一时说不清其中几个判断来自哪份材料、哪一版记录。后来，组织在保留最终结果的同时，也留下必要的来源和修改记录。再遇到疑问时，可以直接回到原始依据核对，而不必把全部材料重新检查一遍。',
  },
  shared_responsibility: {
    id: 'INSTR_SHARED_RESPONSIBILITY_V2',
    family: 'coop',
    body: '某项目推进时，各环节都按时完成自己的部分，交付前却仍发现一处遗漏。复盘发现，并非某个环节没有工作，而是不同环节的责任衔接不清。团队随后明确：前一环节负责形成应提供的信息，后一环节负责依据可用信息作出最终判断；两类责任不同，但都可能影响共同结果。',
  },
};

export function workSegmentFromRuntimeSegment(segmentIndex: number) {
  if (segmentIndex === 1) return 1;
  if (segmentIndex === 3) return 2;
  if (segmentIndex === 5) return 3;
  return Math.max(1, Math.min(3, Math.ceil(segmentIndex / 2)));
}

export function parseInstructionPlan(snapshot: unknown): PreSegmentInstructionPlan | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const plan = (snapshot as Record<string, unknown>).instructionPlan;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return null;
  return plan as PreSegmentInstructionPlan;
}

export function fallbackInstructionPlan(): PreSegmentInstructionPlan {
  return {
    version: 'pre_segment_instruction_v2',
    durationSeconds: 15,
    orderType: 'fixed_neutral_order',
    orderValue: 'N1_N2_N3',
    instructionTypes: { 1: 'neutral_1', 2: 'neutral_2', 3: 'neutral_3' },
    instructionTextIds: {
      1: PRE_SEGMENT_INSTRUCTION_TEXTS.neutral_1.id,
      2: PRE_SEGMENT_INSTRUCTION_TEXTS.neutral_2.id,
      3: PRE_SEGMENT_INSTRUCTION_TEXTS.neutral_3.id,
    },
    instructionFamilies: { 1: 'neutral', 2: 'neutral', 3: 'neutral' },
  };
}
