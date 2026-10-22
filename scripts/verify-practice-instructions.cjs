// No application server or database required. Run with Node from any directory.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const webRequire = Module.createRequire(path.join(root, 'apps/web/package.json'));
const ts = webRequire('typescript');
const React = webRequire('react');
const { renderToStaticMarkup } = webRequire('react-dom/server');
const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n+$/, '');
const approvedHash = '36e0cc4e48056ed9f3a6cfddff96055895bc63967d0c6d7aa2e6118191959221';
const loaded = new Map();
function load(relative) {
  const filename = path.join(root, relative);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: filename,
  }).outputText;
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = mod.require.bind(mod);
  mod.require = (name) => name.startsWith('@/') ? load(`apps/web/src/${name.slice(2)}.ts`) : nativeRequire(name);
  loaded.set(filename, mod);
  mod._compile(compiled, filename);
  return mod.exports;
}
const { PRACTICE_INSTRUCTIONS_TEXT } = load('apps/web/src/content/practice-instructions.ts');
const text = normalize(PRACTICE_INSTRUCTIONS_TEXT);
assert.equal(crypto.createHash('sha256').update(text).digest('hex'), approvedHash, 'Approved text changed; researcher approval required');
const source = path.join(root, '00_start_materials/第十一次开会/测试轮指导语.txt');
if (fs.existsSync(source)) assert.equal(text, normalize(fs.readFileSync(source, 'utf8')), 'Source TXT differs character-for-character');
const expectedVisible = text.split('\n').filter(Boolean).map((line) => line.startsWith('- ') ? line.slice(2) : line.replace(/^\*\*按钮：(.*)\*\*$/, '$1')).join('');
const { PracticeTutorialOverlay } = load('apps/web/src/components/practice-tutorial-overlay.tsx');
let cases = 0;
for (const role of ['A', 'B']) {
  for (const aiLevel of ['BASIC', 'ADVANCED']) {
    for (const duration of [0.5, 5, 9]) {
      const markup = renderToStaticMarkup(React.createElement(PracticeTutorialOverlay, {
        role, aiLevel, practiceDurationMinutes: duration, sessionCode: 'COPY_AUDIT', participantId: role,
      }));
      const visible = markup.replace(/<[^>]*>/g, '');
      assert.equal(visible, expectedVisible, `${role}/${aiLevel}/${duration}: rendered wording changed`);
      cases++;
    }
  }
}
const { SessionTopbar } = load('apps/web/src/components/session-topbar.tsx');
const props = { roleLabel: 'A', currentLabel: 'Fixture', stageLabel: '当前阶段剩余时间', countdownLabel: '20:00', connectionStatus: 'connected' };
const withoutQuit = renderToStaticMarkup(React.createElement(SessionTopbar, props));
assert.ok(!withoutQuit.includes('退出实验'), 'No quit callback must mean no quit control');
const withQuit = renderToStaticMarkup(React.createElement(SessionTopbar, { ...props, onQuit() {} }));
assert.ok(withQuit.includes('退出实验'), 'Main workspace quit control missing');
assert.ok(withQuit.indexOf('退出实验') < withQuit.indexOf('网络正常'), 'Quit must precede connection status');
assert.ok(!withQuit.includes('fixed'), 'Topbar quit must not be a floating control');
console.log(JSON.stringify({ approvedCopySha256: approvedHash, sourceTxtCompared: fs.existsSync(source), exactRenderedCases: cases, topbarChecks: 4, result: 'PASS' }, null, 2));
