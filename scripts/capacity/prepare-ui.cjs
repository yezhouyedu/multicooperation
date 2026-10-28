const { adminToken, remoteNode, write } = require('./lib.cjs');
async function main() {
  const token = await adminToken();
  const setup = remoteNode(`const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const c=await p.experimentConfig.findUnique({where:{id:'default'}});const r=await p.experimentRun.findUnique({where:{id:c.activeExperimentRunId}});const q=await p.questionnaireTemplate.findUnique({where:{id:c.practiceQuizTemplateId}});console.log(JSON.stringify({run:r.name,answers:Object.fromEntries(q.items.map(i=>[i.id,i.correctOption]))}));await p.$disconnect()})()`);
  if (!setup.run.startsWith('CAPACITY_')) throw Error('UI smoke requires an active dedicated capacity run');
  const tag = `CAPACITY_UI_${Date.now()}`;
  const post = async (route, body, admin = false) => {
    const res = await fetch('https://aiseek.tech/api' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!res.ok) throw Error(`HTTP ${res.status} ${route}`); return res.json();
  };
  const phones = [tag + '_0', tag + '_1'];
  await post('/admin/participants', { entries: phones.map((phone) => ({ phone })) }, true);
  const boots = await Promise.all(phones.map((phone) => post('/auth/login', { phone })));
  if (boots[0].sessionCode !== boots[1].sessionCode) throw Error('UI smoke pair mismatch');
  for (const boot of boots) await post(`/experiment/session/${boot.sessionCode}/ready-practice`, { participantId: boot.participantId });
  for (const boot of boots) await post(`/experiment/session/${boot.sessionCode}/practice-quiz`, { participantId: boot.participantId, answers: setup.answers });
  for (const boot of boots) {
    const res = await fetch(`https://aiseek.tech/api/experiment/session/${boot.sessionCode}/runtime?participantId=${boot.participantId}`); const state = await res.json(); boot.role = state.assignedRole;
    await post(`/experiment/session/${boot.sessionCode}/progress`, { role: boot.role, stage: 'practice_tutorial_completed', payload: { capacitySmoke: tag } });
  }
  write('ui-manifest.json', { tag, boots, boundary: 'API setup to practice; subsequent UI saves use real frontend, real API and database; not a full browser walkthrough' });
  console.log(JSON.stringify({ tag, boots }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
