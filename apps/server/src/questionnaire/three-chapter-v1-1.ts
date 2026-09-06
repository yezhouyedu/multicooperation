import { Prisma } from '@prisma/client';

export const FORMAL_QUESTIONNAIRE_TEMPLATE_ID = 'three-chapter-questionnaire-v3-0';

type ItemType = 'scale' | 'single' | 'multi' | 'number' | 'text';
type QuestionnaireItem = {
  code: string;
  prompt: string;
  type: ItemType;
  construct: string;
  reverse: boolean;
  required: boolean;
  order: number;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  options?: string[];
  maxLength?: number;
  showIf?: { code: string; equals: string };
};

const agreement = (code: string, prompt: string, construct: string, order: number, reverse = false): QuestionnaireItem => ({
  code,
  prompt,
  type: 'scale',
  construct,
  reverse,
  required: true,
  order,
  min: 1,
  max: 7,
  minLabel: '非常不同意',
  maxLabel: '非常同意',
});

const scale = (
  code: string,
  prompt: string,
  construct: string,
  order: number,
  minLabel: string,
  maxLabel: string,
): QuestionnaireItem => ({
  code,
  prompt,
  type: 'scale',
  construct,
  reverse: false,
  required: true,
  order,
  min: 1,
  max: 7,
  minLabel,
  maxLabel,
});

const single = (code: string, prompt: string, construct: string, order: number, options: string[]): QuestionnaireItem => ({
  code,
  prompt,
  type: 'single',
  construct,
  reverse: false,
  required: true,
  order,
  options,
});

const section = (title: string, items: QuestionnaireItem[], description?: string) => ({ title, description, items });

export const formalQuestionnaireTemplate = {
  schemaVersion: 2,
  version: 'three_chapter_v3_0_20260816',
  title: '人口特征统计和其他信息采集问卷',
  recruitmentExcluded: true,
  segmentSurvey: section('工作段回顾', [
    agreement('SEG-WL-01', '这段任务的脑力需求很高。', '脑力负荷', 1),
    agreement('SEG-WL-02', '完成这段任务，我付出了很大努力。', '努力投入', 2),
    agreement('SEG-TP-01', '这段任务的节奏让我感到匆忙。', '时间压力', 3),
    agreement('SEG-SD-02', '任务 2 让我难以持续专注于任务 1。', '任务2干扰感', 4),
    agreement('SEG-AI-01', '这段中，任务 1 的 AI 帮助我更快整理材料或形成初步结果。', '任务1 AI帮助感', 5),
    agreement('SEG-AI-02', '这段中，检查、修改或核验任务 1 的 AI 输出花费了较多精力。', '任务1 AI校验成本', 6),
    agreement('SEG-AI-03', '这段中，任务 1 的 AI 输出总体上是可靠的。', '任务1 AI可靠性', 7),
    agreement('SEG-CONF-01', '我对这段中提交或形成的任务 1 内容的准确性有信心。', '段内输出信心', 8),
    agreement('SEG-FAT-01', '这段结束后，我感到疲惫。', '段内疲劳', 9),
  ]),
  postSurvey: {
    title: '人口特征统计和其他信息采集问卷',
    commonSections: [
      section('合作、验证与责任信念', [
        agreement('POST-COMP-02', '在类似任务中，自己可见的材料和 AI 通常不能完全替代另一名成员掌握的信息。', '队友信息边际价值', 1),
        agreement('POST-TRACE-01', '在形成最终判断时，清楚记录信息来源有助于提高判断质量。', '来源透明', 2),
        agreement('POST-TRACE-03', '当角色 A 的信息可能影响最终判断时，核查其中的关键依据是有必要的。', '复核必要性', 3),
        agreement('POST-TRACE-02', '使用 AI 整理信息时，仍需要能够追溯到原始材料。', 'AI输出可追溯', 4),
        agreement('POST-RESP-01', '使用 AI 辅助完成任务后，最终判断仍由使用者负责。', '使用者责任', 5),
        agreement('POST-RESP-02', '在团队任务中，即使使用 AI，最终结果仍需要两名成员共同负责。', '团队共同责任', 6),
        agreement('POST-BYP-01-R', '在类似任务中，如果 AI 已给出较完整的答案，另一名成员的信息通常不会再明显改变我的判断。', 'AI绕过队友信念', 7, true),
      ], '以下问题请结合刚才的任务体验，以及你对类似任务的理解作答。题目中如出现 AI，请按题目描述的情境作答。'),
      section('AI 事后信念与实际使用体验', [
        agreement('POST-AI-01', '本次实验中，任务 1 的 AI 对我完成任务有帮助。', 'AI总体帮助', 1),
        agreement('POST-AI-02', '任务 1 的 AI 帮助我更快整理文字材料。', 'AI文字材料帮助', 2),
        agreement('POST-AI-04', '在处理图片或截图时，任务 1 的 AI 对我有帮助。', 'AI图片材料帮助', 3),
        agreement('POST-AI-05', '本次实验中，任务 1 的 AI 输出总体上是可靠的。', 'AI可靠性', 4),
        agreement('POST-AI-06', '以后完成类似任务时，我会继续使用 AI，同时核查关键依据。', 'AI校验意向', 5),
        agreement('POST-AI-07-R', '当 AI 给出完整答案时，我通常不再核查原始材料。', 'AI过度依赖', 6, true),
        agreement('POST-AI-08', '在类似任务中，AI 更适合协助整理信息，而不是替我作出最终判断。', 'AI任务边界', 7),
      ]),
      section('AI 能力变化预期', [
        scale('POST-AICHG-01', '请设想：在刚才这类任务中，你可以使用一种能够协助你更好地完成信息处理的 AI 工具。与刚才实际采用的工作方式相比，你预计自己完成任务 1 的速度会怎样变化？', '速度变化预期', 1, '明显变慢', '明显变快'),
        scale('POST-AICHG-02', '请设想：在刚才这类任务中，你可以使用一种能够协助你更好地完成信息处理的 AI 工具。与刚才实际采用的工作方式相比，你预计自己在任务 1 中形成的内容准确性会怎样变化？', '质量变化预期', 2, '明显下降', '明显提高'),
        scale('POST-AICHG-03A', '请设想：在刚才这类任务中，你可以使用一种能够协助你更好地完成信息处理的 AI 工具。与刚才实际采用的工作方式相比，你预计自己用于整理角色 B 可以直接使用的信息以及撰写交接备注的时间和精力会怎样变化？', '交接投入变化预期', 3, '明显减少', '明显增加'),
        scale('POST-AICHG-03B', '请设想：在刚才这类任务中，你可以使用一种能够协助你更好地完成信息处理的 AI 工具。与刚才实际采用的工作方式相比，你预计自己查看、核验或使用角色 A 信息的程度会怎样变化？', '上游信息使用变化预期', 4, '明显减少', '明显增加'),
        scale('POST-AICHG-04', '请设想：在刚才这类任务中，你可以使用一种能够协助你更好地完成信息处理的 AI 工具。与刚才实际采用的工作方式相比，你预计自己用于任务 2 的时间会怎样变化？', '任务2时间变化预期', 5, '明显减少', '明显增加'),
      ]),
      section('任务策略、切换恢复与整体体验', [
        agreement('POST-STR-02', '任务 2 的个人奖励让我更愿意投入时间。', '任务2奖励吸引', 1),
        agreement('POST-STR-03', '为了完成更多任务 2，我有时减少了对任务 1 材料的检查。', '任务1核查牺牲', 2),
        agreement('POST-STR-04', '我倾向于把多道任务 2 集中在一起处理，而不是每出现一道就立即处理。', '任务2集中处理', 3),
        agreement('POST-STR-05', '从任务 2 返回任务 1 后，我通常需要一段时间才能重新进入之前的工作状态。', '切换恢复成本', 4),
        single('POST-STRATEGY-01A', '在任务 1 和任务 2 之间分配时间时，哪一种情况最接近你的实际做法？', '任务切换策略', 5, ['看到任务 2 提醒后尽快处理', '任务 1 暂时卡住时处理', '累积几道后集中处理', '工作段接近结束时处理', '基本不处理任务 2', '没有固定策略', '其他']),
        single('POST-STRATEGY-01B', '在任务 1 和任务 2 之间分配时间时，哪一种情况最接近你的实际做法？', '任务切换策略', 6, ['看到任务 2 提醒后尽快处理', '任务 1 暂时卡住时处理', '等待任务 1 AI 返回时处理', '累积几道后集中处理', '工作段接近结束时处理', '基本不处理任务 2', '没有固定策略', '其他']),
        agreement('POST-EFF-01', '我在整个实验中一直认真完成任务。', '整体努力', 7),
        agreement('POST-FAT-01', '到实验后期，我的疲劳明显影响了表现。', '整体疲劳', 8),
      ]),
      section('任务 2 到达与提醒感知', [
        single('MC2-01', '就你的实际感受而言，任务 2 的新题在可作答列表中出现的方式更接近哪一种？', '主观到达方式感知', 1, ['一题一题陆续出现', '多题集中出现', '没有注意', '无法判断']),
        scale('MC2-02', '你看到任务 2 提醒的频率如何？', '提醒频率感知', 2, '很低', '很高'),
      ]),
      section('线上实施情况', [
        single('POST-INT-01', '正式工作段中，除下一题单独询问的实验网站外 AI 使用外，你是否出现过其他与实验要求不一致的情况？例如较长时间离开实验、使用实验网站之外的网页或软件帮助处理任务，或请他人帮助。', '总体异常自报', 1, ['没有', '有']),
        single('POST-INT-02', '正式工作段中，你是否使用过实验网站之外的 AI 工具帮助处理实验任务？这里包括通过其他网页、软件或设备使用的生成式 AI。', '外部 AI 专项自报', 2, ['没有', '有']),
        {
          ...single('POST-INT-03', '如果出现过其他与实验要求不一致的情况，以下哪些情况曾经发生？', '异常类型诊断', 3, ['较长时间离开实验页面或电脑', '使用搜索引擎、其他网页或软件帮助处理任务', '使用手机或其他设备帮助处理任务', '请他人帮助处理任务', '其他']),
          type: 'multi' as const,
          showIf: { code: 'POST-INT-01', equals: '有' },
        },
      ], '本部分回答用于评估线上实验实施情况，请按照实际情况作答。如实回答本身不会改变已经产生的实验报酬。'),
      section('文本主题识别', [{
        code: 'MC3-02',
        prompt: '以下哪些主题在工作段开始前或休息后阅读的文本中出现过？请选择你确实记得的内容。',
        type: 'multi', construct: '文本主题识别', reverse: false, required: true, order: 1,
        options: ['行业运行和市场变化', '成员之间的信息互补', '资料来源的核验和记录', '团队成员对最终结果的共同责任', '企业经营与技术动态', '政策或监管变化', '其他', '没有印象'],
      }]),
      section('AI 图片功能感知', [single('MC1-03', '本实验提供的任务 1 AI 是否支持上传图片并识别图片内容？', '图片功能感知', 1, ['支持', '不支持', '不确定'])]),
      section('界面体验与任务理解', [
        scale('POST-TECH-01', '本次实验中，页面切换、输入和提交等操作总体上是否流畅？', '界面流畅度', 1, '很不流畅', '很流畅'),
        scale('POST-TECH-02', '本次实验中，任务 1 AI 返回结果的等待时间是否明显过长？', 'AI等待时间感知', 2, '完全没有', '非常明显'),
        agreement('POST-TECH-03', '我清楚理解自己作为角色 A 或角色 B 需要完成的任务。', '任务理解', 3),
        agreement('POST-TECH-04', '我清楚理解信息来源选项的含义和选择规则。', '来源规则理解', 4),
      ]),
      section('人口特征统计', [
        { code: 'DEMO-01', prompt: '你的年龄是？', type: 'number', construct: '年龄', reverse: false, required: true, order: 1 },
        single('DEMO-02', '你的性别是？', '性别', 2, ['男', '女', '其他', '不愿透露']),
        single('DEMO-03', '你的最高学历或当前在读阶段是？', '最高学历', 3, ['本科在读', '本科', '硕士在读', '硕士', '博士在读', '博士', '其他']),
        single('DEMO-04', '你的专业或主要学习、工作背景更接近哪一类？', '专业大类', 4, ['经济金融', '管理', '理工', '人文社科', '医学', '艺术', '其他']),
        { code: 'DEMO-05', prompt: '你已有多少年大学阶段以上学习或正式工作经历？', type: 'number', construct: '学习或工作年限', reverse: false, required: true, order: 5 },
        single('DEMO-06', '你是否有金融、投资、咨询、商业分析、行业研究或类似公司信息处理经验？', '商业分析相关经验', 6, ['无', '有，少于 6 个月', '有，6 个月至 1 年', '有，1 年以上']),
        single('DEMO-07', '你当前的主要身份是？', '当前身份', 7, ['本科生', '硕士生', '博士生', '企业员工', '自由职业', '其他']),
        single('DEMO-08', '你此前是否参加过类似的商业判断、人机协作或多任务实验？', '类似实验经历', 8, ['没有', '参加过 1 次', '参加过 2 次及以上', '不确定']),
      ]),
      section('报酬规则清晰度', [scale('POST-PAY-02', '你认为本次实验的报酬计算规则是否清楚？', '报酬规则清晰度', 1, '很不清楚', '很清楚')]),
    ],
    manipulationChecks: {},
    roleSpecific: {
      A: section('角色 A 复盘', [
        agreement('POST-A-05', '整理任务 1 信息时，我通常预期角色 B 会查看并使用这些内容。', '预期下游使用', 1),
        agreement('POST-A-01', '填写 A 端信息表时，我会考虑角色 B 能否直接使用我整理的信息。', '下游导向', 2),
        agreement('POST-A-02', '我在交接备注中尽量写出角色 B 可以进一步核验的方向。', '可核验交接备注', 3),
        agreement('POST-A-04', '收到角色 B 的反馈后，我会据此调整后续的信息整理或交接备注。', '反馈学习', 4),
      ]),
      B: section('角色 B 复盘', [
        agreement('POST-B-06', '在查看角色 A 的信息之前，我通常预期其中会包含可能影响最终判断的内容。', '上游信息价值预期', 1),
        agreement('POST-B-01', '在形成最终判断前，我通常会查看角色 A 已开放的信息。', '查看角色A信息倾向', 2),
        agreement('POST-B-02A', '时间紧张时，我更可能只依赖自己看到的材料，减少查看角色 A 的信息。', '时间压力下减少查看', 3),
        agreement('POST-B-02B', '时间紧张时，我更可能依赖自己看到的材料和 AI，减少查看角色 A 的信息。', '时间压力下减少查看', 4),
        agreement('POST-B-03', '角色 A 的交接备注帮助我发现了原本可能遗漏的机会或风险。', '交接备注边际价值', 5),
        agreement('POST-B-04', '核验角色 A 的原始材料需要较多时间和精力。', '复核成本', 6),
        agreement('POST-B-05', '我发送反馈时，主要希望帮助角色 A 改进后续工作。', '反馈动机', 7),
      ]),
    },
  },
};

export type FormalQuestionnaireTemplate = typeof formalQuestionnaireTemplate;

export function formalQuestionnaireTemplateJson() {
  return JSON.parse(JSON.stringify(formalQuestionnaireTemplate)) as Prisma.InputJsonValue;
}
