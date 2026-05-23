import { AiLevel, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const questionnaireItems = [
  {
    id: 'q1',
    prompt: '你当前的认知负荷感受如何？',
    options: ['很低', '较低', '中等', '较高', '很高'],
  },
  {
    id: 'q2',
    prompt: '你当前对任务规则的把握程度如何？',
    options: ['非常不清楚', '不太清楚', '一般', '比较清楚', '非常清楚'],
  },
];

async function main() {
  const phones = ['AAA', 'BBB', 'CCC', 'DDD'];
  for (const phone of phones) {
    await prisma.participant.upsert({
      where: { phone },
      update: { nickname: `测试账号-${phone}`, role: null },
      create: { phone, nickname: `测试账号-${phone}` },
    });
  }

  const template = await prisma.questionnaireTemplate.upsert({
    where: { id: 'default-break-questionnaire' },
    update: {
      title: '默认休息问卷',
      items: questionnaireItems,
      isActive: true,
    },
    create: {
      id: 'default-break-questionnaire',
      title: '默认休息问卷',
      items: questionnaireItems,
      isActive: true,
    },
  });

  await prisma.experimentConfig.upsert({
    where: { id: 'default' },
    update: {
      workDurationMinutes: 20,
      breakDurationMinutes: 5,
      segmentOneAiLevel: AiLevel.BASIC,
      segmentTwoAiLevel: AiLevel.ADVANCED,
      segmentThreeAiLevel: AiLevel.ADVANCED,
      activeQuestionnaireTemplateId: template.id,
    },
    create: {
      id: 'default',
      workDurationMinutes: 20,
      breakDurationMinutes: 5,
      segmentOneAiLevel: AiLevel.BASIC,
      segmentTwoAiLevel: AiLevel.ADVANCED,
      segmentThreeAiLevel: AiLevel.ADVANCED,
      activeQuestionnaireTemplateId: template.id,
    },
  });

  console.log(
    'Seed completed: participants, experiment config, and questionnaire template. Use admin baseline import to load company materials.',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
