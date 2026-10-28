const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { output, adminToken, remoteNode, write } = require('./lib.cjs');
const { setupAi } = require('./ai-load.cjs');
const users = Number(process.argv[2] || 10);
const mode = process.argv[3] || 'pilot';
if (![10, 30, 60].includes(users) || !['pilot', 'full'].includes(mode)) throw Error('Usage: run.cjs 10|30|60 pilot|full');
const tag = `C${Date.now()}_${users}_${mode}`;
const base = 'https://aiseek.tech/api';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stopFile = path.join(output, `${tag}.stop`);
let stop = false; let token; let originalRun; let run; let monitor;
const actors = []; const controllers = new Set(); const timings = {}; const errors = []; const milestones = [];
let firstFormalAt = null; let global5xx = [];
let aiLoad;
const stats = { tag, users, mode, startedAt: new Date().toISOString(), requests: 0, bytes: 0, sseConnections: 0, sseReconnects: 0, sseRuntimeEvents: 0, materialDownloads: 0, draftSaves: 0, sideAnswers: 0, feedbacks: 0, questionnaires: 0, realAiRequests: 0 };
function log(type, data = {}) { const item = { at: new Date().toISOString(), type, ...data }; milestones.push(item); console.log(JSON.stringify(item)); }
function guard() { if (fs.existsSync(stopFile)) { stop = true; throw Error(fs.readFileSync(stopFile, 'utf8')); } if (stop) throw Error('test stopped'); }
function sample(label, ms, status) { (timings[label] ??= []).push(ms); stats.requests++; if (status >= 500) { global5xx.push(Date.now()); global5xx = global5xx.filter((t) => t > Date.now() - 30000); if (global5xx.length >= 3) fs.writeFileSync(stopFile, 'Three unexpected 5xx responses within 30 seconds'); } }
async function request(route, body, label = route.replace(/session\/[^/]+/g, 'session/:code').replace(/tasks\/[^/]+/g, 'tasks/:task').replace(/sidetask\/[^/]+/g, 'sidetask/:plan'), admin = false, timeout = 45000) {
  guard();
  const headers = { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined || route.endsWith('/draft') || route.endsWith('/heartbeat') || route.endsWith('/exposure') ? {} : { 'Idempotency-Key': randomUUID() }) };
  const attempts = label === 'admin:create-run' ? 1 : 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    guard(); const started = Date.now();
    const controller = new AbortController(); controllers.add(controller); const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
      const text = await res.text(); stats.bytes += Buffer.byteLength(text); sample(label.split('?')[0], Date.now() - started, res.status);
      if (!res.ok) throw Object.assign(Error(`HTTP ${res.status} ${label}: ${text.slice(0, 180)}`), { status: res.status });
      if (attempt > 1) log('request_recovered', { label, attempt });
      return JSON.parse(text);
    } catch (error) {
      if (!error.status) sample(label.split('?')[0], Date.now() - started, 'network');
      errors.push({ at: new Date().toISOString(), label, status: error.status ?? 'network', attempt, message: error.message.slice(0, 300), cause: error.cause?.code ?? error.cause?.message });
      if (error.status || stop || attempt === attempts) throw error;
      await sleep(attempt * 500);
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }
}
async function refresh(actor) {
  const data = await request(`/experiment/session/${actor.sessionCode}/runtime?participantId=${actor.participantId}`, undefined, 'runtime');
  actor.runtime = data; actor.updatedAt = Date.now(); actor.role = data.assignedRole; return data;
}
async function stream(actor) {
  let delay = 1000; let connectedOnce = false;
  while (!stop && !actor.done) {
    const controller = new AbortController(); controllers.add(controller);
    try {
      const params = new URLSearchParams({ participantId: actor.participantId, ...(actor.lastEventId ? { lastEventId: actor.lastEventId } : {}) });
      const res = await fetch(`${base}/experiment/session/${actor.sessionCode}/events?${params}`, { signal: controller.signal });
      if (!res.ok || !res.body) throw Error(`SSE HTTP ${res.status}`);
      actor.connected = true; stats.sseConnections++; if (connectedOnce) stats.sseReconnects++; connectedOnce = true; delay = 1000;
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (!stop && !actor.done) {
        const chunk = await reader.read(); if (chunk.done) break;
        stats.bytes += chunk.value.length; buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n');
        let index;
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, index); buffer = buffer.slice(index + 2);
          const lines = frame.split('\n'); const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
          const id = lines.find((line) => line.startsWith('id:'))?.slice(3).trim(); if (id) actor.lastEventId = id;
          if (type === 'runtime') { const raw = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n'); try { actor.runtime = JSON.parse(raw); actor.updatedAt = Date.now(); stats.sseRuntimeEvents++; } catch { throw Error('Invalid SSE runtime JSON'); } }
          if (type === 'runtime_error') throw Error('SSE runtime_error');
        }
      }
      await reader.cancel().catch(() => undefined);
    } catch (error) { if (!stop && !actor.done) log('sse_reconnect', { actor: actor.index, message: error.message }); }
    finally { actor.connected = false; controller.abort(); controllers.delete(controller); }
    if (!stop && !actor.done) { await refresh(actor).catch(() => undefined); await sleep(delay); delay = Math.min(delay * 2, 30000); }
  }
}
async function progress(actor, stage, payload = {}) { return request(`/experiment/session/${actor.sessionCode}/progress`, { role: actor.role, stage, payload }, `progress:${stage}`); }
async function timestamp(actor, eventType, payload = {}, extra = {}) { return request(`/experiment/session/${actor.sessionCode}/timestamps/event`, { participantId: actor.participantId, role: actor.role, eventType, clientTime: new Date().toISOString(), phase: actor.runtime?.phase === 'practice' ? 'practice' : 'formal', segmentIndex: actor.runtime?.segmentIndex, payload: { ...payload, clientEventId: randomUUID(), capacityTest: tag }, ...extra }, `timestamp:${eventType}`); }
async function save(actor, section = 'main') {
  const task = actor.runtime.currentTask; if (!task) return;
  const key = `${task.id}:${section}`;
  if (!actor.revisions.has(key)) {
    const draft = await request(`/experiment/session/${actor.sessionCode}/tasks/${task.id}/draft?role=${actor.role}&section=${section}&participantId=${actor.participantId}`, undefined, 'draft:get');
    actor.revisions.set(key, draft.revision ?? 0);
  }
  const value = `容量测试 ${tag} 第${++actor.edits}次填写；材料整理和判断，非真实被试数据。`;
  const payload = section === 'feedback' ? { q1: actor.index % 2 ? '是' : '否', q2: '是', q3: '比较有帮助', q4: '不确定', q5: '证据来源更清楚' } : actor.role === 'A' ? {
    metrics: { indicator: '材料中的经营指标', content: '120' }, materialClues: Array.from({ length: 6 }, (_, i) => ({ materialName: `材料${i + 1}`, opportunityStatus: 'HAS', opportunityEvidence: value.slice(0, 30), riskStatus: 'HAS', riskEvidence: '存在需要核对的不确定信息' })), noteTypes: ['核验建议'], handoffMemo: value.slice(0, 150),
  } : { opportunities: [{ text: value.slice(0, 55), source: '自有材料' }, { text: '测试：业务规模存在增长线索', source: '自有材料' }], risks: [{ text: '测试：核对后再判断', source: '自有材料' }, { text: '测试：材料信息存在不确定性', source: '自有材料' }], overallAssessment: value.slice(0, 150), finalDecision: '不投资', confidence: 4, noObviousOpportunity: false, noObviousRisk: false, ordinaryOpportunityCount: 2, ordinaryRiskCount: 2 };
  const result = await request(`/experiment/session/${actor.sessionCode}/tasks/${task.id}/draft`, { role: actor.role, section, payload, expectedRevision: actor.revisions.get(key), mutationId: randomUUID() }, 'draft:save');
  actor.revisions.set(key, result.revision); stats.draftSaves++;
  actor.lastDraft = { taskId: task.id, section, payload, revision: result.revision };
}
async function materials(actor) {
  const list = (actor.runtime.currentTask?.company?.materials ?? []).filter((item) => {
    const role = item.metadata?.participantRole;
    return role == null || role === 'shared' || role === actor.role || (actor.role === 'B' && role === 'A' && actor.runtime.phase !== 'practice' && actor.runtime.bHasViewedAMaterials);
  });
  const material = list.find((item) => item.url && !actor.materials.has(item.id)); if (!material) return;
  actor.materials.add(material.id); const started = Date.now();
  let url = material.url.startsWith('http') ? material.url : 'https://aiseek.tech' + (material.url.startsWith('/api/') ? material.url : '/api' + material.url);
  let response; let bytes;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { response = await fetch(url, { signal: AbortSignal.timeout(60000) }); bytes = await response.arrayBuffer(); break; }
    catch (error) { const detail = { at: new Date().toISOString(), label: 'material:download', actor: actor.index, url, attempt, message: error.message, cause: error.cause?.code ?? error.cause?.message }; errors.push(detail); if (attempt === 3) throw Error(JSON.stringify(detail)); await sleep(attempt * 500); }
  }
  sample('material:download', Date.now() - started, response.status);
  if (!response.ok || bytes.byteLength === 0) throw Error(`Material download HTTP ${response.status}`);
  stats.materialDownloads++; stats.bytes += bytes.byteLength;
}
function answers(template) {
  const items = template.items ?? (template.sections ?? []).flatMap((section) => section.items);
  return Object.fromEntries(items.map((item) => [item.code || item.id, item.type === 'text' ? '系统容量测试，非真实被试意见' : item.type === 'number' ? Math.min(item.max ?? 25, Math.max(item.min ?? 0, 25)) : item.type === 'scale' ? Math.ceil(((item.min ?? 1) + (item.max ?? 7)) / 2) : item.type === 'multi' ? [item.options[0]] : item.options?.at(-1) ?? '测试答案']));
}
async function heartbeats(actor) {
  // A pilot actor can finish before slower pairs. Keep its page-equivalent
  // heartbeat alive until the entire run actually closes the sessions.
  while (!stop) {
    if (actor.runtime?.phase === 'formal_work' && Date.now() > actor.nextHeartbeat) {
      await request(`/experiment/session/${actor.sessionCode}/integrity/heartbeat`, { participantId: actor.participantId, lastValidActivityAt: new Date().toISOString(), clientTime: new Date().toISOString() }, 'heartbeat');
      actor.nextHeartbeat = Date.now() + 10000;
    }
    await sleep(400);
  }
}
async function act(actor) {
  let formalEntered = false;
  while (!stop && !actor.done) {
    guard(); let runtime = actor.runtime;
    if (!runtime || Date.now() - actor.updatedAt > (actor.connected ? 10000 : 5000)) runtime = await refresh(actor);
    actor.role = runtime.assignedRole;
    const phaseKey = `${runtime.phase}:${runtime.segmentIndex}`;
    if (actor.phaseKey !== phaseKey) { actor.phaseKey = phaseKey; actor.phaseAt = Date.now(); actor.openedInstruction = false; actor.surveySent = false; log('phase', { actor: actor.index, role: actor.role, phase: runtime.phase, segment: runtime.segmentIndex }); }
    const prefix = `/experiment/session/${actor.sessionCode}`;
    if (runtime.phase === 'instruction' || runtime.phase === 'practice_ready') {
      if (!actor.readyPractice && Date.now() - actor.phaseAt > 30000) { await progress(actor, 'instruction_viewed'); await request(prefix + '/ready-practice', { participantId: actor.participantId }, 'ready-practice'); actor.readyPractice = true; }
    } else if (runtime.phase === 'practice_quiz') {
      if (!actor.quizSent && Date.now() - actor.phaseAt > 10000) { await request(prefix + '/practice-quiz', { participantId: actor.participantId, answers: actor.quizAnswers }, 'practice-quiz'); actor.quizSent = true; }
    } else if (runtime.phase === 'practice') {
      if (!actor.tutorialDone && Date.now() - actor.phaseAt > 10000) {
        for (const stepKey of runtime.practiceTutorialState?.steps ?? []) await progress(actor, 'practice_tutorial_step_completed', { stepKey });
        await progress(actor, 'practice_tutorial_completed'); actor.tutorialDone = true; await refresh(actor);
      }
      if (actor.tutorialDone && Date.now() > actor.nextSave && (runtime.segmentRemainingSeconds ?? 0) > 4) { await save(actor); actor.nextSave = Date.now() + 12000 + actor.index % 4 * 1000; }
      if (Date.now() > actor.nextMaterial) { await materials(actor); actor.nextMaterial = Date.now() + 20000; }
    } else if (runtime.phase === 'formal_ready') {
      if (!actor.readyFormal && Date.now() - actor.phaseAt > 5000) {
        await request(prefix + '/integrity/commitment', { participantId: actor.participantId, accepted: true, answers: { formalOnly: true, offscreenRule: true, dropoutRule: true, privacyRule: true } }, 'integrity:commitment');
        await request(prefix + '/ready-formal', { participantId: actor.participantId }, 'ready-formal'); actor.readyFormal = true;
      }
    } else if (runtime.phase === 'pre_segment_instruction') {
      if (!actor.openedInstruction) { await request(prefix + '/pre-segment-instruction/open', { participantId: actor.participantId }, 'instruction:open'); actor.openedInstruction = true; }
      if (!actor.instructions.has(runtime.segmentIndex) && (runtime.preSegmentInstruction?.remainingSeconds ?? 15) === 0) { await request(prefix + '/pre-segment-instruction/complete', { participantId: actor.participantId }, 'instruction:complete'); actor.instructions.add(runtime.segmentIndex); }
    } else if (runtime.phase === 'formal_work') {
      if (!formalEntered) { formalEntered = true; actor.firstFormalAt = Date.now(); if (!firstFormalAt) firstFormalAt = Date.now(); }
      actor.formalSegments.add(runtime.segmentIndex);
      aiLoad?.maybeStart(actor);
      if (runtime.onlineIntegrity?.outcome === 'SELF_DROPPED' || runtime.onlineIntegrity?.outcome === 'STOP_AFTER_A_DROPOUT') throw Error('Unexpected participant dropout during steady load');
      if (Date.now() > actor.nextSave && runtime.currentTask) { await save(actor); actor.nextSave = Date.now() + 10000 + actor.index % 5 * 1000; }
      if (Date.now() > actor.nextMaterial) { await materials(actor); actor.nextMaterial = Date.now() + 20000; }
      for (const item of runtime.sideTaskQueue ?? []) if (!actor.released.has(item.planId)) { await request(prefix + `/sidetask/${item.planId}/exposure`, { participantId: actor.participantId, eventType: 'side_task_released' }, 'side:released'); actor.released.add(item.planId); }
      const pulse = runtime.sideTaskConfig?.notificationPulse;
      if (pulse && !actor.pulses.has(pulse.id)) {
        actor.pulses.add(pulse.id);
        for (const planId of pulse.planIds) await request(prefix + `/sidetask/${planId}/exposure`, { participantId: actor.participantId, eventType: 'side_task_notified', payload: { pulseId: pulse.id, reason: pulse.reason, newCount: pulse.newCount, windowStart: pulse.windowStart, windowEnd: pulse.windowEnd, displayed: true } }, 'side:notified');
      }
      const pending = (runtime.sideTaskQueue ?? []).find((item) => !item.answered && !actor.answered.has(item.planId));
      if (pending && Date.now() > actor.nextSide && runtime.segmentRemainingSeconds > 20) {
        await timestamp(actor, 'side_area_entered', {}, { sideTaskPlanId: pending.planId });
        await request(prefix + `/sidetask/${pending.planId}/exposure`, { participantId: actor.participantId, eventType: 'side_task_opened' }, 'side:opened');
        await sleep(8000 + actor.index % 4 * 1000);
        await request(prefix + `/sidetask/${pending.planId}/answer`, { participantId: actor.participantId, answer: actor.edits % 2 ? 'A' : 'B' }, 'side:answer');
        await timestamp(actor, 'side_activity', { activityKind: 'answer' }, { sideTaskPlanId: pending.planId });
        await timestamp(actor, 'main_area_returned'); actor.answered.add(pending.planId); actor.nextSide = Date.now() + 35000 + actor.index % 5 * 1000; stats.sideAnswers++;
      }
      if (actor.role === 'B' && runtime.bCanSubmit && runtime.segmentRemainingSeconds > 15 && runtime.currentTask && !actor.completedTasks.has(runtime.currentTask.id)) {
        const taskId = runtime.currentTask.id;
        if (actor.index % 3 !== 0) {
          await request(prefix + `/tasks/${taskId}/view-a-info`, {}, 'b:view-a-info');
          await request(prefix + `/tasks/${taskId}/view-a-materials`, {}, 'b:view-a-materials');
          const exposureId = randomUUID(); const context = { taskAssignmentId: taskId, companyId: runtime.currentTask.company.id };
          await timestamp(actor, 'b_a_original_material_view_started', { exposureId }, context);
          await refresh(actor); await materials(actor); await sleep(6000 + actor.index % 3 * 1000);
          await timestamp(actor, 'b_a_original_material_view_ended', { exposureId, endReason: 'view_state_changed' }, context);
        }
        await save(actor, 'feedback');
        await sleep(5000 + actor.index % 3 * 1000);
        await progress(actor, 'b_feedback_submitted', { taskId, companyName: runtime.currentTask.company?.name, companyNo: runtime.currentTask.sortOrder, ...actor.lastDraft.payload });
        if (actor.index % 2) { await progress(actor, 'b_feedback_to_a', { taskId, companyName: runtime.currentTask.company?.name, companyNo: runtime.currentTask.sortOrder, helpfulness: '比较有帮助', missingContent: '不确定', improvement: '证据来源更清楚', appreciative: true }); stats.feedbacks++; }
        await request(prefix + `/tasks/${taskId}/b-complete`, {}, 'b:complete'); actor.completedTasks.add(taskId); await refresh(actor);
      }
      if (mode === 'pilot' && Date.now() - actor.firstFormalAt > 360000) { actor.done = true; }
    } else if (runtime.phase === 'formal_break' || runtime.phase === 'end') {
      const template = runtime.questionnaireTemplate;
      if (template && !runtime.questionnaireSubmitted && !actor.surveySent && Date.now() - actor.phaseAt > 15000) {
        const data = answers(template);
        await request(prefix + '/questionnaire/draft', { participantId: actor.participantId, answers: data }, 'questionnaire:draft');
        await request(prefix + '/questionnaire', { participantId: actor.participantId, answers: data }, 'questionnaire:submit'); stats.questionnaires++; actor.surveys++; actor.surveySent = true;
        await refresh(actor);
        // The final segment survey and post survey share phase=end; reset per actual template.
        if (actor.runtime.questionnaireTemplate?.kind !== template.kind) { actor.surveySent = false; actor.phaseAt = Date.now(); }
      }
      if (runtime.phase === 'end' && !template) { if (actor.surveys !== 4) throw Error('Final questionnaire count is not four'); await progress(actor, 'payment_phone_confirmed', { confirmed: true, capacityTest: tag }); actor.done = true; }
      if (runtime.phase === 'end' && actor.surveySent && actor.runtime.questionnaireTemplate?.kind === 'post_survey' && actor.runtime.questionnaireSubmitted) { await progress(actor, 'payment_phone_confirmed', { confirmed: true, capacityTest: tag }); actor.done = true; }
    }
    await sleep(700 + actor.index % 7 * 30);
  }
}
function summary() {
  const percentiles = Object.fromEntries(Object.entries(timings).map(([label, values]) => { const sorted = values.toSorted((a, b) => a - b); return [label, { count: values.length, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))], max: sorted.at(-1) }]; }));
  return { ...stats, completedAt: new Date().toISOString(), elapsedSeconds: Math.round((Date.now() - Date.parse(stats.startedAt)) / 1000), firstFormalAt: firstFormalAt && new Date(firstFormalAt).toISOString(), actorsCompleted: actors.filter((a) => a.done).length, errors, percentiles, actors: actors.map((a) => ({ index: a.index, sessionCode: a.sessionCode, participantId: a.participantId, role: a.role, phase: a.runtime?.phase, segmentIndex: a.runtime?.segmentIndex, formalSegments: [...a.formalSegments], completedTasks: a.completedTasks.size, edits: a.edits, sideAnswers: a.answered.size, lastDraft: a.lastDraft })) };
}
async function main() {
  token = await adminToken();
  if (process.env.CAPACITY_REAL_AI === 'CNY50_APPROVED') aiLoad = setupAi(tag, users);
  const initial = remoteNode(`const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const c=await p.experimentConfig.findUnique({where:{id:'default'}}); const q=await p.questionnaireTemplate.findUnique({where:{id:c.practiceQuizTemplateId}});console.log(JSON.stringify({run:c.activeExperimentRunId,quiz:q.items,onlineIntegrityEnabled:c.onlineIntegrityEnabled}));await p.$disconnect()})()`);
  originalRun = initial.run;
  run = (await request('/admin/experiment-runs', { name: `CAPACITY_${tag}` }, 'admin:create-run', true)).run;
  write(`${tag}-manifest.json`, { tag, users, mode, originalRun, runId: run.id, startedAt: stats.startedAt });
  await request(`/admin/experiment-runs/${run.id}/activate`, {}, 'admin:activate-run', true);
  const phones = Array.from({ length: users }, (_, i) => `CAPACITY_${tag}_${i}`);
  await request('/admin/participants', { entries: phones.map((phone) => ({ phone })) }, 'admin:test-accounts', true);
  monitor = spawn(process.execPath, [path.join(__dirname, 'monitor.cjs'), tag], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'] });
  const logins = await Promise.all(phones.map((phone) => request('/auth/login', { phone }, 'login')));
  for (let index = 0; index < logins.length; index++) {
    const actor = { ...logins[index], index, role: logins[index].role, quizAnswers: Object.fromEntries(initial.quiz.map((item) => [item.id, item.correctOption])), revisions: new Map(), materials: new Set(), released: new Set(), pulses: new Set(), answered: new Set(), instructions: new Set(), formalSegments: new Set(), completedTasks: new Set(), edits: 0, surveys: 0, nextSave: 0, nextMaterial: 0, nextSide: 0, nextHeartbeat: 0, done: false };
    actors.push(actor); await refresh(actor);
  }
  const codes = new Set(actors.map((a) => a.sessionCode)); if (codes.size !== users / 2) throw Error(`Expected ${users / 2} pairs, got ${codes.size}`);
  write(`${tag}-manifest.json`, { tag, users, mode, originalRun, runId: run.id, startedAt: stats.startedAt, actors: actors.map(({ participantId, sessionCode, role, index }) => ({ participantId, sessionCode, role, index })) });
  log('paired', { users, groups: codes.size, qualityMonitoringEnabled: initial.onlineIntegrityEnabled });
  const ticker = setInterval(() => { write(`${tag}-progress.json`, summary()); console.log(JSON.stringify({ at: new Date().toISOString(), tag, requests: stats.requests, phases: actors.reduce((acc, a) => { const key = `${a.runtime?.phase}:${a.runtime?.segmentIndex}`; acc[key] = (acc[key] || 0) + 1; return acc; }, {}), errors: errors.length })); if (Date.now() - Date.parse(stats.startedAt) > 100 * 60000) fs.writeFileSync(stopFile, '100-minute maximum run duration'); }, 30000);
  actors.forEach((actor) => {
    actor.streamPromise = stream(actor);
    actor.heartbeatPromise = heartbeats(actor).catch((error) => { fs.writeFileSync(stopFile, 'Heartbeat failed: ' + error.message); });
  });
  try { await Promise.all(actors.map((actor) => act(actor))); }
  finally { clearInterval(ticker); }
  if (aiLoad) { stats.ai = await aiLoad.finish(); stats.realAiRequests = stats.ai.requested; if (stats.ai.errors.length) throw Error('Real AI workload had errors; inspect AI report'); }
  if (mode === 'pilot') for (const actor of actors.filter((a) => a.role === 'A')) await request(`/experiment/session/${actor.sessionCode}/integrity/quit`, { participantId: actor.participantId, reason: 'capacity_pilot_completed' }, 'pilot:controlled-quit');
  log('completed', { users, mode, requests: stats.requests, errors: errors.length });
}
process.on('SIGINT', () => { stop = true; for (const controller of controllers) controller.abort(); });
main().catch((error) => { stats.failure = error.message; stats.failureCause = error.cause?.code ?? error.cause?.message; console.error('CAPACITY FAILED', error.message, stats.failureCause ?? ''); process.exitCode = 1; }).finally(async () => {
  stop = true; for (const controller of controllers) controller.abort();
  fs.writeFileSync(path.join(output, `${tag}.done`), new Date().toISOString());
  if (originalRun && token) {
    try { const res = await fetch(`${base}/admin/experiment-runs/${originalRun}/activate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) }); if (!res.ok) throw Error(`HTTP ${res.status}`); stats.originalRunRestored = true; }
    catch (error) { stats.restoreError = error.message; process.exitCode = 1; }
  }
  write(`${tag}-report.json`, summary()); write(`${tag}-milestones.json`, milestones);
  if (monitor) { await sleep(1000); if (monitor.exitCode === null) monitor.kill(); }
});
