const fs = require('node:fs');
const path = require('node:path');
const { output, remoteNode, write } = require('./lib.cjs');
const ledgerPath = path.join(output, 'ai-budget-ledger.json');
// User approved CNY 50. No billing-console access: reserve the documented worst
// output + thinking limits, rather than estimating cost from short visible replies.
// Short fresh conversations (system text + image <=30k input tokens) only.
const reserves = { BASIC: 0.5, ADVANCED: 14.6 };
function setupAi(tag, users) {
  const quotas = users === 30 ? { BASIC: 3, ADVANCED: 0 } : users === 60 ? { BASIC: 9, ADVANCED: 3 } : { BASIC: 0, ADVANCED: 0 };
  const settings = remoteNode(`const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const s=await p.aiSettings.findUnique({where:{id:'default'}});console.log(JSON.stringify({basicModel:s.basicModel,advancedModel:s.advancedModel,basicHost:new URL(s.basicBaseUrl).hostname,advancedHost:new URL(s.advancedBaseUrl).hostname,promptBytes:Buffer.byteLength(s.systemPromptMain+s.systemPromptSide)}));await p.$disconnect()})()`);
  if (settings.basicModel !== 'qwen3.5-35b-a3b' || settings.advancedModel !== 'qwen3.7-max-2026-06-08' || settings.promptBytes > 15000 || ![settings.basicHost, settings.advancedHost].every((host) => host === 'dashscope.aliyuncs.com')) throw Error('AI budget assumptions changed; paid test disabled');
  const screenshot = path.join(output, '../..', 'output/playwright/capacity-ui-offline.png');
  const image = fs.existsSync(screenshot) ? 'data:image/png;base64,' + fs.readFileSync(screenshot).toString('base64') : null;
  const metrics = { requested: 0, done: 0, errors: [], results: [], maxConcurrent: 0, active: 0, quotas, settings, budgetCny: 50, priceSource: 'https://help.aliyun.com/zh/model-studio/model-pricing' };
  const jobs = [];
  function maybeStart(actor) {
    const runtime = actor.runtime;
    if (actor.aiRequested || runtime.phase !== 'formal_work' || !runtime.aiEnabled || !runtime.currentTask || !actor.firstFormalAt || Date.now() - actor.firstFormalAt < 90000) return;
    const level = runtime.aiLevel;
    if (!(quotas[level] > 0)) return;
    actor.aiRequested = true; quotas[level]--;
    const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8')) : { approvedCny: 50, reservedCny: 0, requests: [] };
    const reserve = reserves[level];
    if (ledger.reservedCny + reserve > 50.00001) throw Error('AI CNY50 conservative reservation exhausted');
    ledger.reservedCny = Math.round((ledger.reservedCny + reserve) * 100) / 100;
    ledger.requests.push({ tag, participantId: actor.participantId, level, reserveCny: reserve, at: new Date().toISOString() });
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
    const side = metrics.requested % 2 === 0;
    const body = { sessionCode: actor.sessionCode, participantId: actor.participantId, role: actor.role, contextType: side ? 'side' : 'main', phase: 'formal', segmentIndex: runtime.segmentIndex, aiLevel: level, companyId: runtime.currentTask.company.id, taskAssignmentId: runtime.currentTask.id, ...(side && runtime.sideTaskQueue?.[0] ? { sideTaskPlanId: runtime.sideTaskQueue[0].planId } : {}), message: level === 'ADVANCED' ? '这是容量测试截图。请说明截图左侧区域的标题，并用一句话提醒核对证据，合计不超过60个汉字。' : '容量测试：材料称某公司营收增长，但未提供来源。请用三点说明如何核对证据，合计不超过80个汉字。', ...(level === 'ADVANCED' && image ? { attachments: [image] } : {}) };
    metrics.requested++; metrics.active++; metrics.maxConcurrent = Math.max(metrics.maxConcurrent, metrics.active);
    const job = (async () => {
      const started = Date.now(); let firstTokenMs = null; let firstFrameMs = null; let lastDeltaMs = null; let chunks = 0; let deltas = 0; let done = false; let requestId;
      try {
        const response = await fetch('https://aiseek.tech/api/ai/chat-stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(190000) });
        if (!response.ok || !response.body) throw Error('AI HTTP ' + response.status);
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          chunks++; buffer += decoder.decode(chunk.value, { stream: true }); let index;
          while ((index = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (!line.trim()) continue;
            const frame = JSON.parse(line);
            firstFrameMs ??= Date.now() - started;
            if (frame.type === 'start') requestId = frame.requestId;
            if (frame.type === 'delta') { firstTokenMs ??= Date.now() - started; lastDeltaMs = Date.now() - started; deltas++; }
            if (frame.type === 'error') throw Error(frame.message);
            if (frame.type === 'done') { if (frame.mode !== 'provider' || !frame.reply) throw Error('AI did not return a real provider reply'); done = true; }
          }
        }
        if (!done || !deltas) throw Error('AI stream ended without completion');
        metrics.done++; metrics.results.push({ actor: actor.index, level, contextType: body.contextType, image: Boolean(body.attachments), requestId, firstFrameMs, firstTokenMs, deltaSpanMs: lastDeltaMs - firstTokenMs, totalMs: Date.now() - started, deltas, chunks });
      } catch (error) { metrics.errors.push({ actor: actor.index, level, requestId, message: error.message, elapsedMs: Date.now() - started }); }
      finally { metrics.active--; write(`${tag}-ai.json`, metrics); }
    })();
    jobs.push(job);
  }
  return { maybeStart, finish: async () => { await Promise.all(jobs); write(`${tag}-ai.json`, metrics); return metrics; } };
}
module.exports = { setupAi };
