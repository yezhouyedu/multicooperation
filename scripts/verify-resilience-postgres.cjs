// Destructive fault injection is permitted ONLY against this disposable local database/container.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const req = createRequire(path.join(root, 'apps/server/package.json'));
const { PrismaClient } = req('@prisma/client');
const url = process.env.DATABASE_URL;
if (!url || new URL(url).hostname !== '127.0.0.1' || new URL(url).port !== '15432' || new URL(url).pathname !== '/multi_coop_resilience_20261028') throw Error('Refusing non-sandbox database');
const db = new PrismaClient({ datasources: { db: { url } } });
const { ExperimentService } = require('../apps/server/dist/src/experiment/experiment.service');
const { ExperimentAuditService } = require('../apps/server/dist/src/recording/experiment-audit.service');
const service = new ExperimentService(db, new ExperimentAuditService(db));
const out = path.join(root, 'output/resilience-20261028'); fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evidence = { startedAt: new Date().toISOString(), checks: [], boundary: 'disposable PostgreSQL16 + real local Nest process + synthetic upstream, not production capacity' };
let child; let paused = false; let upstream; let session;
function check(name, detail) { evidence.checks.push({ name, detail, passed: true }); console.log('PASS', name, JSON.stringify(detail ?? {})); }
async function api(route, body, signal) {
  const res = await fetch('http://127.0.0.1:13001' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: signal ?? AbortSignal.timeout(25000) });
  return { status: res.status, text: await res.text() };
}
async function start() {
  const log = fs.openSync(path.join(out, 'isolated-server.log'), 'a');
  child = spawn(process.execPath, ['dist/src/main.js'], { cwd: path.join(root, 'apps/server'), windowsHide: true, stdio: ['ignore', log, log], env: {
    ...process.env, NODE_ENV: 'production', DATABASE_URL: url, SERVER_PORT: '13001', ADMIN_PASSWORD: 'isolated-only', STORAGE_ROOT: path.join(out, 'storage'),
    OPENAI_BASE_URL: 'http://127.0.0.1:13002/v1', OPENAI_API_KEY: 'synthetic-only', OPENAI_MODEL: 'synthetic',
    OPENAI_ADVANCED_BASE_URL: 'http://127.0.0.1:13002/v1', OPENAI_ADVANCED_API_KEY: 'synthetic-only', OPENAI_ADVANCED_MODEL: 'synthetic', AI_REQUEST_TIMEOUT_MS: '10000',
  } }); fs.closeSync(log);
  for (let i = 0; i < 60; i++) { if (child.exitCode !== null) throw Error('Isolated server exited'); try { const res = await api('/health'); if (res.status === 200) return; } catch {} await sleep(300); }
  throw Error('Isolated server did not become ready');
}
async function stop() { if (child && child.exitCode === null) { const exited = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await exited; } }
async function main() {
  await db.$connect();
  const tag = Date.now().toString(36).toUpperCase();
  const a = await db.participant.create({ data: { phone: `ISOLATED_${tag}_A`, role: 'A' } });
  const b = await db.participant.create({ data: { phone: `ISOLATED_${tag}_B`, role: 'B' } });
  const company = await db.company.create({ data: { name: 'Isolated contract company', roundLabel: tag, sector: 'test', tags: [], summary: '', materials: [] } });
  session = await db.session.create({ data: { code: `R${tag}`, status: 'IN_PROGRESS', runtimePhase: 'FORMAL_WORK', currentPhase: 'FORMAL', currentSegmentIndex: 1, currentSegmentType: 'WORK', currentSegmentStarts: new Date(), currentSegmentEnds: new Date(Date.now() + 3600000), experimentSnapshot: { aiEnabled: true, aiCondition: 'BASIC', onlineIntegrity: { enabled: false } } } });
  await db.pairing.create({ data: { sessionId: session.id, participantAId: a.id, participantBId: b.id } });
  const task = await db.taskAssignment.create({ data: { sessionId: session.id, companyId: company.id, sortOrder: 1, sequenceIndex: 1, phase: 'FORMAL' } });
  const save = (expectedRevision, mutationId, role = 'A', section = 'main') => service.saveTaskDraft(session.code, task.id, { role, section, expectedRevision, mutationId, payload: { marker: mutationId } });
  const races = await Promise.allSettled(Array.from({ length: 60 }, (_, i) => save(0, `same-revision-${i}`)));
  assert.equal(races.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(races.filter((item) => item.status === 'rejected' && item.reason.getStatus?.() === 409).length, 59);
  check('60 actual database saves: one winner, 59 version conflicts', { succeeded: 1, expected409: 59 });
  const winner = await db.taskAssignment.findUniqueOrThrow({ where: { id: task.id } });
  const mutation = winner.draftVersions['A:main'].mutationId;
  const duplicates = await Promise.all(Array.from({ length: 20 }, () => save(0, mutation)));
  assert(duplicates.every((item) => item.duplicate && item.revision === 1));
  assert.equal(await db.taskProgress.count({ where: { sessionId: session.id, stage: 'a_form_saved' } }), 1);
  check('20 retries do not advance version or duplicate audit', { version: 1 });
  await Promise.all([save(0, 'b-main', 'B'), save(0, 'b-feedback', 'B', 'feedback')]);
  assert.equal(Object.keys((await db.taskAssignment.findUniqueOrThrow({ where: { id: task.id } })).draftVersions).length, 3);
  check('A/B/feedback revisions remain independent');

  upstream = http.createServer(async (request, response) => {
    let raw = ''; for await (const part of request) raw += part;
    const body = JSON.parse(raw); const message = JSON.stringify(body.messages.at(-1));
    if (message.includes('HANG_BODY')) { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.write(': waiting\n\n'); return; }
    if (message.includes('DROP_STREAM')) { response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.write('data: {"choices":[{"delta":{"content":"partial-contract"}}]}\n\n'); setTimeout(() => response.destroy(), 100); return; }
    response.writeHead(200, { 'Content-Type': 'text/event-stream' }); response.end('data: {"choices":[{"delta":{"content":"local-contract-ok"}}]}\n\ndata: [DONE]\n\n');
  });
  await new Promise((resolve) => upstream.listen(13002, '127.0.0.1', resolve));
  await start();
  const prefix = `/experiment/session/${session.code}`;
  const got = await api(`${prefix}/tasks/${task.id}/draft?role=A&participantId=${a.id}`);
  assert.equal(JSON.parse(got.text).revision, 1); check('real HTTP GET draft reports durable version');
  const aiBody = { sessionCode: session.code, participantId: a.id, role: 'A', phase: 'formal', contextType: 'main', companyId: company.id, taskAssignmentId: task.id, segmentIndex: 1, aiLevel: 'BASIC' };
  const ok = await api('/ai/chat-stream', { ...aiBody, message: 'NORMAL' });
  assert(ok.text.includes('"type":"done"')); check('real HTTP stream completes and audits synthetic upstream');
  const hungAt = Date.now(); const timeout = await api('/ai/chat-stream', { ...aiBody, message: 'HANG_BODY' });
  assert(timeout.text.includes('AI请求超时')); assert(Date.now() - hungAt >= 9900); check('hung response body hits configured 10-second deadline', { elapsedMs: Date.now() - hungAt });
  const controller = new AbortController(); const cancel = api('/ai/chat-stream', { ...aiBody, message: 'HANG_BODY_CANCEL' }, controller.signal).catch(() => null);
  await sleep(500); controller.abort(); await cancel;
  for (let i = 0; i < 30; i++) { if (await db.aiMessageLog.count({ where: { sessionId: session.id, providerStatus: 'cancelled' } })) break; await sleep(100); }
  assert(await db.aiMessageLog.count({ where: { sessionId: session.id, providerStatus: 'cancelled' } })); check('client disconnect cancels upstream and closes wait audit');
  const dropped = await api('/ai/chat-stream', { ...aiBody, message: 'DROP_STREAM' });
  assert(dropped.text.includes('"type":"error"') && !dropped.text.includes('"type":"done"'));
  assert(await db.aiMessageLog.count({ where: { sessionId: session.id, providerStatus: 'error', content: 'partial-contract' } })); check('partial stream is preserved as error, not success');
  const beforeRestart = await db.experimentEvent.count({ where: { sessionId: session.id, eventType: 'platform_service_interruption' } });
  await stop(); await start();
  const restored = await api(`${prefix}/tasks/${task.id}/draft?role=A&participantId=${a.id}`);
  assert.equal(JSON.parse(restored.text).revision, 1); assert.equal(JSON.parse(restored.text).payload.marker, mutation);
  assert(await db.experimentEvent.count({ where: { sessionId: session.id, eventType: 'platform_service_interruption' } }) > beforeRestart);
  check('actual Nest process restart preserves draft and records platform incident');
  await sleep(5500);
  execFileSync('docker', ['pause', 'multi_coop_resilience_20261028'], { stdio: 'pipe' }); paused = true;
  await sleep(18000);
  execFileSync('docker', ['unpause', 'multi_coop_resilience_20261028'], { stdio: 'pipe' }); paused = false;
  for (let i = 0; i < 60; i++) { const incident = await db.experimentEvent.findFirst({ where: { sessionId: session.id, eventType: 'platform_service_interruption', payload: { path: ['reason'], equals: 'liveness_gap' } } }); if (incident) break; await sleep(500); }
  assert(await db.experimentEvent.findFirst({ where: { sessionId: session.id, eventType: 'platform_service_interruption', payload: { path: ['reason'], equals: 'liveness_gap' } } }));
  check('18-second real sandbox PostgreSQL interruption leaves a recovery audit');
  const started = await db.experimentEvent.count({ where: { sessionId: session.id, eventType: 'ai_wait_started' } });
  const ended = await db.experimentEvent.count({ where: { sessionId: session.id, eventType: 'ai_wait_ended' } });
  assert.equal(started, ended); check('all AI wait windows closed', { started, ended });
  evidence.completedAt = new Date().toISOString(); evidence.result = 'PASS';
}
main().catch((error) => { evidence.result = 'FAIL'; evidence.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
  if (paused) execFileSync('docker', ['unpause', 'multi_coop_resilience_20261028'], { stdio: 'pipe' });
  await stop(); upstream?.closeAllConnections(); upstream?.close(); service.onModuleDestroy(); await db.$disconnect();
  fs.writeFileSync(path.join(out, 'postgres-contract.json'), JSON.stringify(evidence, null, 2));
});
