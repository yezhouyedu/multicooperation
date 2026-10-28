const fs = require('node:fs');
const path = require('node:path');
const { output, adminToken, write } = require('./lib.cjs');
const tag = process.argv[2];
if (!/^C\d+_(10|30|60)_(pilot|full)$/.test(tag || '')) throw Error('Exact capacity tag required');
const manifest = JSON.parse(fs.readFileSync(path.join(output, tag + '-manifest.json'), 'utf8'));
async function main() {
  const token = await adminToken(); const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const codes = [...new Set(manifest.actors.map((a) => a.sessionCode))];
  const started = Date.now();
  const response = await fetch('https://aiseek.tech/api/admin/export-jobs', { method: 'POST', headers, body: JSON.stringify({ sessionCodes: codes, includeIncompleteSessions: true }), signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw Error('Export create HTTP ' + response.status);
  const { job } = await response.json();
  if (job.status !== 'completed') throw Error('Export incomplete: ' + job.status + ' ' + (job.errorMessage ?? ''));
  const download = await fetch(`https://aiseek.tech/api/admin/export-jobs/${job.id}/download`, { headers, signal: AbortSignal.timeout(300000) });
  if (!download.ok) throw Error('Export download HTTP ' + download.status);
  const zip = Buffer.from(await download.arrayBuffer());
  fs.writeFileSync(path.join(output, `${tag}-export.zip`), zip);
  const receipt = { tag, jobId: job.id, sessionCodes: codes, users: manifest.users, bytes: zip.length, elapsedMs: Date.now() - started, status: job.status };
  write(`${tag}-export.json`, receipt); console.log(JSON.stringify(receipt));
}
main().catch((e) => { console.error(e.message); process.exitCode = 1; });
