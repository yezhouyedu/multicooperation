const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../apps/server/package.json'));
const { PrismaClient } = req('@prisma/client');
const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).port !== '15432' || new URL(url).pathname !== '/multi_coop_resilience_20261028') throw Error('Refusing non-sandbox database');
const db = new PrismaClient({ datasources: { db: { url } } });
const { AuthService } = require('../apps/server/dist/src/auth/auth.service');
const { ExperimentAuditService } = require('../apps/server/dist/src/recording/experiment-audit.service');
const { ExperimentConditionAssignmentService } = require('../apps/server/dist/src/experiment/experiment-condition-assignment.service');
const service = new AuthService(db, new ExperimentAuditService(db), new ExperimentConditionAssignmentService(db));
async function main() {
  await db.session.updateMany({ where: { status: 'WAITING', pairings: { some: { participantA: { phone: { startsWith: 'BURST_' } } } } }, data: { status: 'TERMINATED' } });
  await db.sideTaskItem.createMany({ skipDuplicates: true, data: [1, 2, 3].flatMap((workSegment) => Array.from({ length: 120 }, (_, i) => ({ itemCode: `LOCAL_NEUTRAL_${workSegment}_${i}`, workSegment, poolType: '普通中性池', text: 'Synthetic local contract item', question: 'Synthetic question', optionA: 'A', optionB: 'B' }))) });
  const themes = { '互补分工': ['C1_divided_information','C2_handoff_value','C3_integration','C4_complementary_roles','C5_redundancy_boundary'], '验证留痕': ['V1_source_link','V2_version_history','V3_change_log','V4_targeted_verification','V5_avoid_full_recheck'], '共同责任': ['S1_joint_approval','S2_sequential_responsibility','S3_role_accountability','S4_selective_crosscheck','S5_escalation_feedback'] };
  await db.sideTaskItem.createMany({ skipDuplicates: true, data: [1, 2, 3].flatMap((workSegment) => Object.entries(themes).flatMap(([narrativeCategory, subtypes]) => subtypes.flatMap((narrativeSubtype) => Array.from({ length: 12 }, (_, i) => ({ itemCode: `LOCAL_COOP_${workSegment}_${narrativeSubtype}_${i}`, workSegment, poolType: '合作叙事池', narrativeCategory, narrativeSubtype, text: 'Synthetic local contract item', question: 'Synthetic question', optionA: 'A', optionB: 'B' }))))) });
  await db.company.createMany({ skipDuplicates: true, data: Array.from({ length: 35 }, (_, i) => ({ id: `local-formal-${i}`, name: 'Synthetic local company', roundLabel: `LF${i}`, sector: 'test', tags: [], summary: '', materials: [], sortOrder: i + 1 })) });
  await db.company.upsert({ where: { id: 'local-practice' }, update: {}, create: { id: 'local-practice', name: 'Synthetic practice', roundLabel: 'LP37', sector: 'test', usage: 'practice', tags: [], summary: '', materials: [] } });
  const phones = Array.from({ length: Number(process.argv[2] || 10) }, (_, i) => `BURST_${Date.now()}_${i}`);
  await db.participant.createMany({ data: phones.map((phone) => ({ phone })) });
  const started = Date.now();
  const responses = await Promise.allSettled(phones.map((phone) => service.login(phone)));
  const failures = responses.filter((item) => item.status === 'rejected').map((item) => ({ code: item.reason.code, message: item.reason.message?.slice(0, 250) }));
  const sessions = await db.session.findMany({ where: { pairings: { some: { OR: [{ participantA: { phone: { in: phones } } }, { participantB: { phone: { in: phones } } }] } } }, include: { pairings: true } });
  const result = { users: phones.length, elapsedMs: Date.now() - started, success: responses.length - failures.length, failures, sessions: sessions.length, paired: sessions.filter((session) => session.pairings[0]?.participantAId && session.pairings[0]?.participantBId).length };
  fs.mkdirSync(path.resolve(__dirname, '../output/resilience-20261028'), { recursive: true });
  fs.writeFileSync(path.resolve(__dirname, `../output/resilience-20261028/pairing-${Date.now()}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  assert.equal(failures.length, 0); assert.equal(result.paired, phones.length / 2);
  for (const session of sessions) {
    assert.equal(await db.sideTaskPlan.count({ where: { sessionId: session.id } }), 120);
    assert.equal(await db.taskAssignment.count({ where: { sessionId: session.id, phase: 'FORMAL' } }), await db.company.count({ where: { usage: 'formal' } }));
    assert.equal(await db.experimentEvent.count({ where: { sessionId: session.id, eventType: 'role_assigned' } }), 2);
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
