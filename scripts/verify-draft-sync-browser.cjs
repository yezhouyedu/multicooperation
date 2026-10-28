// Prints a Playwright CLI run-code program; uses real browser IndexedDB and a fake fetch only.
// node scripts/verify-draft-sync-browser.cjs -> pass stdout to playwright-cli run-code.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const ts = createRequire(path.join(root, 'apps/web/package.json'))('typescript');
const compile = (name) => ts.transpileModule(fs.readFileSync(path.join(root, 'apps/web/src/lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('process.env.NEXT_PUBLIC_SERVER_BASE_URL', "'http://127.0.0.1:39876'");
const bundle = `(() => { const idempotency = {}; new Function('exports', ${JSON.stringify(compile('idempotency'))})(idempotency); const sync = {}; new Function('require', 'exports', ${JSON.stringify(compile('draft-sync'))})(() => idempotency, sync); window.draftSync = sync; })()`;
const run = async (page, bundle) => {
  await page.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Isolated draft contract</title>' }));
  await page.goto('http://127.0.0.1:39876/draft-contract');
  await page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase('multi-cooperation-resilience'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }));
  await page.evaluate(bundle);
  const result = await page.evaluate(async () => {
    const api = window.draftSync;
    let checks = 0;
    const assert = (test, label) => { if (!test) throw new Error(label); checks++; };
    const input = (taskId, value) => ({ sessionCode: 'ISOLATED', taskId, role: 'A', section: 'main', payload: { value } });
    const calls = [];
    let release;
    let first = true;
    window.fetch = async (_url, options) => {
      const body = JSON.parse(options.body); calls.push(body);
      if (first) { first = false; await new Promise((resolve) => release = resolve); }
      return new Response(JSON.stringify({ revision: body.expectedRevision + 1 }), { status: 200 });
    };
    await api.hydrateDraft(input('race', 'empty'), 0);
    const older = api.persistDraft(input('race', 'old'));
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
    const newer = api.persistDraft(input('race', 'new'));
    while ((await api.loadLocalDraft('ISOLATED', 'race', 'A')).payload.value !== 'new') await new Promise((resolve) => setTimeout(resolve, 1));
    release();
    const outcomes = await Promise.all([older, newer]);
    assert(!outcomes[0].synced && outcomes[1].synced, 'old ACK must not mark new input synced');
    assert(calls.length === 2 && calls[0].expectedRevision === 0 && calls[1].expectedRevision === 1, 'serialized successor revision');
    assert((await api.loadLocalDraft('ISOLATED', 'race', 'A')).payload.value === 'new', 'latest local content retained');
    assert(await api.getPendingDraftCount() === 0, 'only acknowledged latest queue item deleted');

    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    await api.hydrateDraft(input('offline', 'server'), 3);
    const offline = await api.persistDraft(input('offline', 'unsent'));
    assert(!offline.synced && await api.getPendingDraftCount() === 1, 'offline retains durable queue');
    await api.hydrateDraft(input('offline', 'older server'), 3);
    assert((await api.loadLocalDraft('ISOLATED', 'offline', 'A')).payload.value === 'unsent', 'hydrate never discards pending local draft');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    await api.flushDraftQueue();
    assert(calls.at(-1).expectedRevision === 3 && await api.getPendingDraftCount() === 0, 'reconnect persists known revision');

    window.fetch = async () => new Response('{}', { status: 409 });
    await api.hydrateDraft(input('conflict', 'server'), 1);
    const conflict = await api.persistDraft(input('conflict', 'keep me'));
    assert(conflict.conflict && !conflict.synced, 'conflict surfaced');
    const local = await api.loadLocalDraft('ISOLATED', 'conflict', 'A');
    assert(local.payload.value === 'keep me', 'conflict preserves local text');
    let retries = 0; window.fetch = async () => { retries++; throw new Error('should not retry conflict'); };
    await api.flushDraftQueue();
    assert(retries === 0, 'conflicts are never silently overwritten');

    window.fetch = async () => { throw new Error('network'); };
    await api.hydrateDraft(input('failure', 'empty'), 0);
    const failed = await api.persistDraft(input('failure', 'still here'));
    assert(!failed.synced && (await api.loadLocalDraft('ISOLATED', 'failure', 'A')).payload.value === 'still here', 'network failure preserved');
    return { checks, pending: await api.getPendingDraftCount() };
  });
  await page.reload();
  await page.evaluate(bundle);
  const restored = await page.evaluate(async () => ({ count: await window.draftSync.getPendingDraftCount(), text: (await window.draftSync.loadLocalDraft('ISOLATED', 'failure', 'A')).payload.value }));
  if (restored.count !== result.pending || restored.text !== 'still here') throw new Error('real IndexedDB reload failed');
  return { checks: result.checks + 1, result: 'PASS', boundary: 'real browser IndexedDB, mocked network, no production writes' };
};
process.stdout.write(`async (page) => { const run = ${run.toString()}; return await run(page, ${JSON.stringify(bundle)}); }`);
