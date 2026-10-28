const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const { remoteNode, ssh, output, write } = require('./lib.cjs');
async function main() {
  const before = JSON.parse(fs.readFileSync(path.join(output, 'preflight.json'), 'utf8'));
  const after = remoteNode(`const {PrismaClient}=require('@prisma/client'); const crypto=require('crypto');const p=new PrismaClient();(async()=>{const config=await p.experimentConfig.findUnique({where:{id:'default'}});const snapshots=await p.session.findMany({select:{id:true,experimentSnapshot:true},orderBy:{id:'asc'}});const ai=await p.aiSettings.findUnique({where:{id:'default'}});const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex'); console.log(JSON.stringify({sessions:await p.session.count(),participants:await p.participant.count(),configHash:hash(config),snapshotHash:hash(snapshots),aiHash:hash(ai),probe:await p.serverLiveness.count(),versionedDraft:await p.taskAssignment.count({where:{draftVersions:{not:{}}}}),timeoutMs:process.env.AI_REQUEST_TIMEOUT_MS,migration:await p.$queryRawUnsafe('SELECT migration_name,finished_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 1')}));await p.$disconnect()})()`);
  assert.equal(after.sessions, before.counts.sessions); assert.equal(after.participants, before.counts.participants);
  for (const key of ['configHash', 'snapshotHash', 'aiHash']) assert.equal(after[key], before[key], key);
  assert.equal(after.probe, 1); assert.equal(after.migration[0].migration_name, '20261028090000_resilience_versions');
  const pages = {};
  for (const url of ['/login', '/admin', '/api/health']) { const res = await fetch('https://aiseek.tech' + url, { signal: AbortSignal.timeout(15000) }); assert.equal(res.status, 200); pages[url] = res.status; }
  ssh('sudo chmod 600 /tmp/multi-cooperation-compose.rendered.yml\nsudo chmod 600 /var/backups/multi-cooperation/capacity_20261028T133925+0800/database.dump /var/backups/multi-cooperation/capacity_20261028T133925+0800/server_storage.tar.gz /var/backups/multi-cooperation/capacity_20261028T133925+0800/source.tar.gz /var/backups/multi-cooperation/capacity_20261028T133925+0800/environment.production\n');
  write('postdeploy.json', { at: new Date().toISOString(), after, pages, result: 'PASS' }); console.log(JSON.stringify({ result: 'PASS', protectedBaseline: 'unchanged', pages, migration: after.migration[0].migration_name, timeoutMs: after.timeoutMs }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
