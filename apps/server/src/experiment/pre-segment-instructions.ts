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
    id: 'INSTR_NEUTRAL_1_V1',
    family: 'neutral',
    body: '近来，许多机构不再把 AI 只放在单独的聊天窗口中，而是把它嵌入文档、知识库、搜索和内部工作台。资料入口变多后，信息往往以报告、截图、表格和系统记录等形式同时出现。',
  },
  neutral_2: {
    id: 'INSTR_NEUTRAL_2_V1',
    family: 'neutral',
    body: '企业材料的呈现形式正在变得更杂糅：一份任务中可能同时出现文字说明、表格截图、图片附件、平台导出的记录和简短摘要。不同系统留下的材料格式并不一致，也使信息处理过程更依赖具体场景。',
  },
  neutral_3: {
    id: 'INSTR_NEUTRAL_3_V1',
    family: 'neutral',
    body: '近期行业讨论中，AI 越来越多被视为工作流中的一个组件，而不是一次性问答工具。它可能出现在材料整理、摘要生成、文档编辑或信息检索环节，但不同机构对其接入方式和使用边界仍在试验中。',
  },
  complementarity: {
    id: 'INSTR_COMPLEMENTARITY_V1',
    family: 'coop',
    body: '一些知识工作团队发现，AI 加快单个环节后，流程中的断点反而更容易显现。上游材料整理得更快，并不等于下游判断自然更完整；当成员接触的信息不同，关键线索能否被下一环节理解，仍会影响最终结果。',
  },
  verification_trace: {
    id: 'INSTR_VERIFICATION_TRACE_V1',
    family: 'coop',
    body: '在 AI 进入投研、审计和内部文档流程后，很多团队开始关注另一个问题：线索变多以后，依据是否清楚。若信息来自哪份材料、是否经过复核、原始依据在哪里都不明确，快速生成的内容仍可能在整合时造成遗漏或误判。',
  },
  shared_responsibility: {
    id: 'INSTR_SHARED_RESPONSIBILITY_V1',
    family: 'coop',
    body: '随着 AI 从辅助写作扩展到资料整理和流程协同，一些组织开始重新划分工具与人的边界。工具可以加快初步处理，但最终判断往往仍要由团队承担；如果关键风险没有被看到，问题通常不会只停留在某一次工具调用上。',
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
    version: 'pre_segment_instruction_v1',
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
