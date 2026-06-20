import { Prisma } from '@prisma/client';

export const FORMAL_QUESTIONNAIRE_TEMPLATE_ID = 'three-chapter-questionnaire-v1-1';

export const formalQuestionnaireTemplate = {
  "schemaVersion": 1,
  "version": "three_chapter_v1_1",
  "title": "???????? V1.1",
  "recruitmentExcluded": true,
  "segmentSurvey": {
    "title": "工作段 1 后问卷",
    "items": [
      {
        "code": "SEG-WL-01",
        "prompt": "这段任务的脑力需求很高。",
        "type": "scale",
        "construct": "脑力负荷",
        "reverse": false,
        "required": true,
        "order": 1,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-WL-02",
        "prompt": "完成这段任务我付出了很大努力。",
        "type": "scale",
        "construct": "努力投入",
        "reverse": false,
        "required": true,
        "order": 2,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-TP-01",
        "prompt": "这段任务的节奏让我感到匆忙。",
        "type": "scale",
        "construct": "时间压力",
        "reverse": false,
        "required": true,
        "order": 3,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-TP-02",
        "prompt": "我没有足够时间核查关键内容。",
        "type": "scale",
        "construct": "核查时间不足",
        "reverse": false,
        "required": true,
        "order": 4,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-SD-01",
        "prompt": "任务2的到达打断了我的任务1思路。",
        "type": "scale",
        "construct": "任务2打断",
        "reverse": false,
        "required": true,
        "order": 5,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-SD-02",
        "prompt": "任务2让我难以专注于任务1。",
        "type": "scale",
        "construct": "任务2干扰",
        "reverse": false,
        "required": true,
        "order": 6,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-AI-01",
        "prompt": "这段中，AI 帮我更快整理材料或形成初步输出。",
        "type": "scale",
        "construct": "AI 段内帮助感",
        "reverse": false,
        "required": true,
        "order": 7,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-AI-02",
        "prompt": "检查、修改或核验 AI 输出花费了不少精力。",
        "type": "scale",
        "construct": "AI 校验成本",
        "reverse": false,
        "required": true,
        "order": 8,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-AI-03",
        "prompt": "这段中，AI 输出总体上是可靠的。",
        "type": "scale",
        "construct": "AI 可靠性",
        "reverse": false,
        "required": true,
        "order": 9,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-CONF-01",
        "prompt": "我对这段中提交或形成的内容准确性有信心。",
        "type": "scale",
        "construct": "段内输出信心",
        "reverse": false,
        "required": true,
        "order": 10,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      },
      {
        "code": "SEG-FAT-01",
        "prompt": "这段结束后，我感到疲惫。",
        "type": "scale",
        "construct": "段内疲劳",
        "reverse": false,
        "required": true,
        "order": 11,
        "min": 1,
        "max": 7,
        "minLabel": "非常不同意",
        "maxLabel": "非常同意"
      }
    ]
  },
  "postSurvey": {
    "title": "????",
    "commonSections": [
      {
        "title": "最后问卷：目的猜测",
        "items": [
          {
            "code": "POST-DG-01",
            "prompt": "你认为今天这场实验主要在研究什么？",
            "type": "text",
            "construct": "实验目的猜测",
            "reverse": false,
            "required": true,
            "order": 1,
            "maxLength": 200
          },
          {
            "code": "POST-DG-02",
            "prompt": "实验过程中，你是否觉得某些信息、界面或任务安排在引导你采取某种工作策略？",
            "type": "single",
            "construct": "被引导感",
            "reverse": false,
            "required": true,
            "order": 2,
            "options": [
              "是",
              "否",
              "不确定"
            ],
            "followup": {
              "prompt": "请说明",
              "triggerText": "仅当选择“是”时显示说明文本框。"
            }
          }
        ]
      },
      {
        "title": "最后问卷：合作、验证与责任机制",
        "items": [
          {
            "code": "POST-COMP-01",
            "prompt": "在本任务中，A/B 两端材料各自可能包含影响最终判断的关键信息。",
            "type": "scale",
            "construct": "互补分工",
            "reverse": false,
            "required": true,
            "order": 1,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-COMP-02",
            "prompt": "单靠自己可见材料和 AI，通常难以完全替代另一端的信息。",
            "type": "scale",
            "construct": "队友信息边际价值",
            "reverse": false,
            "required": true,
            "order": 2,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-TRACE-01",
            "prompt": "明确记录信息来源有助于提高最终判断质量。",
            "type": "scale",
            "construct": "来源透明",
            "reverse": false,
            "required": true,
            "order": 3,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-TRACE-02",
            "prompt": "即使 AI 帮助整理内容，也应能追溯到原始材料依据。",
            "type": "scale",
            "construct": "AI 输出可追溯",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-TRACE-03",
            "prompt": "当上游信息影响最终判断时，下游有必要核验关键证据。",
            "type": "scale",
            "construct": "复核必要性",
            "reverse": false,
            "required": true,
            "order": 5,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-RESP-01",
            "prompt": "使用 AI 辅助完成的工作，最终责任仍在使用者本人。",
            "type": "scale",
            "construct": "使用者责任",
            "reverse": false,
            "required": true,
            "order": 6,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-RESP-02",
            "prompt": "团队任务中，即使使用 AI，最终结果仍需要成员共同负责。",
            "type": "scale",
            "construct": "团队共同责任",
            "reverse": false,
            "required": true,
            "order": 7,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-BYP-01-R",
            "prompt": "如果 AI 给出较完整答案，查看队友信息通常没有必要。",
            "type": "scale",
            "construct": "AI 绕过队友",
            "reverse": true,
            "required": true,
            "order": 8,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          }
        ]
      },
      {
        "title": "最后问卷：AI 事后信念",
        "items": [
          {
            "code": "POST-AI-01",
            "prompt": "在本实验中，AI 输出总体上是有帮助的。",
            "type": "scale",
            "construct": "AI 总体帮助",
            "reverse": false,
            "required": true,
            "order": 1,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-AI-02",
            "prompt": "AI 对文字材料整理帮助很大。",
            "type": "scale",
            "construct": "AI 文本能力",
            "reverse": false,
            "required": true,
            "order": 2,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-AI-04",
            "prompt": "AI 对图片、截图或非结构化材料处理帮助很大。",
            "type": "scale",
            "construct": "AI 图片能力",
            "reverse": false,
            "required": true,
            "order": 3,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意",
            "followup": {
              "prompt": "请说明",
              "triggerText": "显示给全体；若某章材料完全不含图片/截图/非结构化材料，可由配置隐藏。"
            }
          },
          {
            "code": "POST-AI-05",
            "prompt": "本实验中，AI 输出总体上是可靠的。",
            "type": "scale",
            "construct": "AI 可靠性",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-AI-06",
            "prompt": "如果以后做类似任务，我会继续使用 AI，但会核查关键证据。",
            "type": "scale",
            "construct": "AI 校验必要性",
            "reverse": false,
            "required": true,
            "order": 5,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-AI-07-R",
            "prompt": "如果 AI 给出完整答案，我通常不需要再花时间核查原始材料。",
            "type": "scale",
            "construct": "AI 过度依赖",
            "reverse": true,
            "required": true,
            "order": 6,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-AI-08",
            "prompt": "AI 更适合帮我整理材料，而不是替我做最终判断。",
            "type": "scale",
            "construct": "AI 任务边界",
            "reverse": false,
            "required": true,
            "order": 7,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          }
        ]
      },
      {
        "title": "最后问卷：策略体验与质量标记",
        "items": [
          {
            "code": "POST-STR-01",
            "prompt": "我通常在任务1卡住或等待 AI 时处理任务2。",
            "type": "scale",
            "construct": "AI 等待期间策略",
            "reverse": false,
            "required": true,
            "order": 1,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-STR-02",
            "prompt": "任务2的个人奖励让我更愿意投入时间。",
            "type": "scale",
            "construct": "任务2激励吸引",
            "reverse": false,
            "required": true,
            "order": 2,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-STR-03",
            "prompt": "为了完成更多任务2，我有时减少了任务1材料核查。",
            "type": "scale",
            "construct": "任务1牺牲",
            "reverse": false,
            "required": true,
            "order": 3,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-STR-04",
            "prompt": "我倾向于把任务2集中处理，而不是一到达就处理。",
            "type": "scale",
            "construct": "任务2集中处理",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-FAT-01",
            "prompt": "到实验后期，我的疲劳明显影响了表现。",
            "type": "scale",
            "construct": "整体疲劳",
            "reverse": false,
            "required": true,
            "order": 5,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-EFF-01",
            "prompt": "我在整个实验中一直认真完成任务。",
            "type": "scale",
            "construct": "努力程度",
            "reverse": false,
            "required": true,
            "order": 6,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-TECH-01",
            "prompt": "实验过程中是否出现卡顿、断线、AI 无响应或页面异常？",
            "type": "single",
            "construct": "技术异常",
            "reverse": false,
            "required": true,
            "order": 7,
            "options": [
              "无",
              "轻微，不影响任务",
              "较明显，影响部分任务",
              "严重，明显影响任务"
            ],
            "followup": {
              "prompt": "请说明",
              "triggerText": "选择“较明显”或“严重”时显示说明文本框。"
            }
          },
          {
            "code": "POST-TECH-02",
            "prompt": "我清楚理解自己在 A/B 角色中的任务要求。",
            "type": "scale",
            "construct": "任务理解",
            "reverse": false,
            "required": true,
            "order": 8,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-TECH-03",
            "prompt": "我清楚理解信息点来源应如何选择。",
            "type": "scale",
            "construct": "来源规则理解",
            "reverse": false,
            "required": true,
            "order": 9,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-TECH-04",
            "prompt": "我曾在平台外与队友交流任务内容。",
            "type": "single",
            "construct": "外部交流",
            "reverse": false,
            "required": true,
            "order": 10,
            "options": [
              "是",
              "否"
            ],
            "followup": {
              "prompt": "请说明",
              "triggerText": "仅当选择“是”时显示说明文本框。"
            }
          }
        ]
      },
      {
        "title": "最后问卷：人口特征统计",
        "items": [
          {
            "code": "DEMO-01",
            "prompt": "你的年龄是？",
            "type": "number",
            "construct": "年龄",
            "reverse": false,
            "required": true,
            "order": 1
          },
          {
            "code": "DEMO-02",
            "prompt": "你的性别是？",
            "type": "single",
            "construct": "性别",
            "reverse": false,
            "required": true,
            "order": 2,
            "options": [
              "男",
              "女",
              "其他",
              "不愿透露"
            ]
          },
          {
            "code": "DEMO-03",
            "prompt": "你的最高学历或当前在读阶段是？",
            "type": "single",
            "construct": "最高学历",
            "reverse": false,
            "required": true,
            "order": 3,
            "options": [
              "本科在读",
              "本科",
              "硕士在读",
              "硕士",
              "博士在读",
              "博士",
              "其他"
            ]
          },
          {
            "code": "DEMO-04",
            "prompt": "你的专业或主要学习/工作背景更接近哪一类？",
            "type": "single",
            "construct": "专业大类",
            "reverse": false,
            "required": true,
            "order": 4,
            "options": [
              "经济金融",
              "管理",
              "理工",
              "人文社科",
              "医学",
              "艺术",
              "其他"
            ]
          },
          {
            "code": "DEMO-05",
            "prompt": "你已有多少年大学阶段以上学习或正式工作经历？",
            "type": "number",
            "construct": "学习或工作年限",
            "reverse": false,
            "required": true,
            "order": 5
          },
          {
            "code": "DEMO-06",
            "prompt": "你是否有金融、投资、咨询、商业分析、行业研究或尽调相关经历？",
            "type": "single",
            "construct": "金融/商业经验",
            "reverse": false,
            "required": true,
            "order": 6,
            "options": [
              "无",
              "有，少于 6 个月",
              "有，6 个月—1 年",
              "有，1 年以上"
            ]
          },
          {
            "code": "DEMO-07",
            "prompt": "你当前的主要身份是？",
            "type": "single",
            "construct": "当前身份",
            "reverse": false,
            "required": true,
            "order": 7,
            "options": [
              "本科生",
              "硕士生",
              "博士生",
              "企业员工",
              "自由职业",
              "其他"
            ]
          },
          {
            "code": "DEMO-08",
            "prompt": "你此前是否参加过类似的商业判断、投资判断或人机协作实验？",
            "type": "single",
            "construct": "类似实验经历",
            "reverse": false,
            "required": true,
            "order": 8,
            "options": [
              "没有",
              "参加过 1 次",
              "参加过 2 次及以上",
              "不确定"
            ]
          }
        ]
      },
      {
        "title": "最后问卷：报酬与开放题",
        "items": [
          {
            "code": "POST-PAY-02",
            "prompt": "你认为本次实验报酬规则是否清楚？",
            "type": "scale",
            "construct": "报酬规则清晰度",
            "reverse": false,
            "required": true,
            "order": 1,
            "min": 1,
            "max": 7,
            "minLabel": "很不清楚，7=很清楚",
            "maxLabel": "很清楚"
          },
          {
            "code": "POST-OPEN-01",
            "prompt": "你在任务1、AI、任务2之间分配时间时，主要遵循什么策略？",
            "type": "text",
            "construct": "策略开放题",
            "reverse": false,
            "required": true,
            "order": 2,
            "maxLength": 300
          }
        ]
      }
    ],
    "manipulationChecks": {
      "ai_upgrade": {
        "title": "最后问卷：第 1 章操纵检验",
        "chapter": 1,
        "items": [
          {
            "code": "MC1-01",
            "prompt": "实验过程中，你使用的 AI 工具能力是否发生过变化？",
            "type": "single",
            "construct": "AI 升级感知",
            "reverse": false,
            "required": true,
            "order": 1,
            "options": [
              "是",
              "否",
              "不确定"
            ]
          },
          {
            "code": "MC1-02",
            "prompt": "如果你认为发生过变化，变化大约发生在什么时候？",
            "type": "single",
            "construct": "升级时点感知",
            "reverse": false,
            "required": true,
            "order": 2,
            "options": [
              "开始时",
              "第一次休息后",
              "第二次休息后",
              "不确定"
            ],
            "followup": {
              "prompt": "请说明",
              "triggerText": "若 MC1-01=“否”，隐藏本题。"
            }
          },
          {
            "code": "MC1-03",
            "prompt": "你使用的 AI 是否支持图片上传或图像识别？",
            "type": "single",
            "construct": "视觉能力感知",
            "reverse": false,
            "required": true,
            "order": 3,
            "options": [
              "是",
              "否",
              "不确定"
            ]
          },
          {
            "code": "MC1-05",
            "prompt": "如果 AI 能力发生变化，你觉得这种变化对任务1的影响是否很大？",
            "type": "scale",
            "construct": "升级实际帮助",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "完全没有影响，7=影响很大",
            "maxLabel": "影响很大",
            "followup": {
              "prompt": "请说明",
              "triggerText": "若 MC1-01=“否”，隐藏本题。"
            }
          }
        ]
      },
      "side_reminder": {
        "title": "最后问卷：第 2 章操纵检验",
        "chapter": 2,
        "items": [
          {
            "code": "MC2-01",
            "prompt": "实验中任务2的到达方式更接近哪一种？",
            "type": "single",
            "construct": "任务2到达节奏感知",
            "reverse": false,
            "required": true,
            "order": 1,
            "options": [
              "持续逐条到达",
              "集中批量到达",
              "不确定"
            ]
          },
          {
            "code": "MC2-02",
            "prompt": "任务2释放频率给你的感觉是：",
            "type": "scale",
            "construct": "任务2频率感知",
            "reverse": false,
            "required": true,
            "order": 2,
            "min": 1,
            "max": 7,
            "minLabel": "很稀疏，7=很频繁",
            "maxLabel": "很频繁"
          },
          {
            "code": "MC2-04",
            "prompt": "你处理任务2时，是否倾向于将多条新闻一起处理或一起交给任务2 AI？",
            "type": "single",
            "construct": "任务2批处理倾向",
            "reverse": false,
            "required": true,
            "order": 3,
            "options": [
              "从不",
              "偶尔",
              "经常",
              "总是"
            ]
          }
        ]
      },
      "coop_narrative": {
        "title": "最后问卷：第 3 章操纵检验",
        "chapter": 3,
        "items": [
          {
            "code": "MC3-01",
            "prompt": "实验开场和休息中阅读的长文本，你认为主要强调了什么主题？",
            "type": "text",
            "construct": "长文本主题开放识别",
            "reverse": false,
            "required": true,
            "order": 1,
            "maxLength": 200
          },
          {
            "code": "MC3-02",
            "prompt": "以下哪些主题在长文本中反复出现过？",
            "type": "multi",
            "construct": "叙事主题识别",
            "reverse": false,
            "required": true,
            "order": 2,
            "options": [
              "多选：行业景气",
              "团队协作",
              "验证与留痕",
              "责任归属",
              "政策变化",
              "公司业绩",
              "技术突破",
              "都没有印象"
            ]
          },
          {
            "code": "MC3-03",
            "prompt": "长文本中是否暗示了某种“应该如何工作”的观点？",
            "type": "single",
            "construct": "规范性提示感知",
            "reverse": false,
            "required": true,
            "order": 3,
            "options": [
              "是",
              "否",
              "不确定"
            ],
            "followup": {
              "prompt": "请说明",
              "triggerText": "仅当选择“是”时显示说明文本框。"
            }
          },
          {
            "code": "MC3-04",
            "prompt": "你觉得实验中阅读的长文本内容总体可信度如何？",
            "type": "scale",
            "construct": "文本可信度",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "完全不可信，7=非常可信",
            "maxLabel": "非常可信"
          }
        ]
      }
    },
    "roleSpecific": {
      "A": {
        "title": "最后问卷：角色复盘 A",
        "items": [
          {
            "code": "POST-A-01",
            "prompt": "我在填写任务表时主要考虑 B 能否直接使用。",
            "type": "scale",
            "construct": "下游导向",
            "reverse": false,
            "required": true,
            "order": 1,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-A-02",
            "prompt": "我在备注中尽量写出 B 可以核验的方向。",
            "type": "scale",
            "construct": "可核验备注",
            "reverse": false,
            "required": true,
            "order": 2,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-A-03-R",
            "prompt": "我有时只完成表格最低要求，而没有充分考虑 B 如何使用。",
            "type": "scale",
            "construct": "最低完成倾向",
            "reverse": true,
            "required": true,
            "order": 3,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-A-04",
            "prompt": "如果能看到更多 B 的反馈，我会调整后续备注写法。",
            "type": "scale",
            "construct": "反馈学习",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          }
        ]
      },
      "B": {
        "title": "最后问卷：角色复盘 B",
        "items": [
          {
            "code": "POST-B-01",
            "prompt": "我通常会在最终判断前查看上游角色A信息。",
            "type": "scale",
            "construct": "查看 A 倾向",
            "reverse": false,
            "required": true,
            "order": 1,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-B-02",
            "prompt": "当时间紧张时，我更可能依赖自有材料和 AI，而减少查看上游信息。",
            "type": "scale",
            "construct": "时间压力下绕过",
            "reverse": false,
            "required": true,
            "order": 2,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-B-03",
            "prompt": "上游备注帮助我发现了原本可能遗漏的机会或风险。",
            "type": "scale",
            "construct": "上游备注边际价值",
            "reverse": false,
            "required": true,
            "order": 3,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-B-04",
            "prompt": "核验上游原始材料的成本较高。",
            "type": "scale",
            "construct": "复核成本",
            "reverse": false,
            "required": true,
            "order": 4,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          },
          {
            "code": "POST-B-05",
            "prompt": "我发送反馈时，主要是为了帮助上游后续改进。",
            "type": "scale",
            "construct": "反馈动机",
            "reverse": false,
            "required": true,
            "order": 5,
            "min": 1,
            "max": 7,
            "minLabel": "非常不同意",
            "maxLabel": "非常同意"
          }
        ]
      }
    }
  }
} as const;

export function formalQuestionnaireTemplateJson(): Prisma.InputJsonValue {
  return formalQuestionnaireTemplate as unknown as Prisma.InputJsonValue;
}
