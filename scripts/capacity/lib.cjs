const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/capacity-20261028');
fs.mkdirSync(output, { recursive: true });
const remoteEnv = { ...process.env };
for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) delete remoteEnv[key];
function ssh(script, timeout = 30000) {
  return execFileSync('ssh', ['-i', 'E:\\Own_program\\multi_cooperation_secrets\\ssh\\first_try.pem', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=15', 'ubuntu@49.233.203.108', 'bash -s'], { input: script.replace(/\r\n/g, '\n'), encoding: 'utf8', env: remoteEnv, timeout, maxBuffer: 10 * 1024 * 1024 });
}
function remoteNode(source, timeout) { return JSON.parse(ssh("docker exec -i -w /app/apps/server multi_cooperation_server_prod node <<'CAPACITY_NODE'\n" + source + '\nCAPACITY_NODE\n', timeout).trim()); }
async function adminToken() {
  // Password stays inside this process. Never print it or persist it in test reports.
  const { password } = remoteNode('process.stdout.write(JSON.stringify({password:process.env.ADMIN_PASSWORD}));');
  const response = await fetch('https://aiseek.tech/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`Admin authentication HTTP ${response.status}`);
  return (await response.json()).token;
}
function write(name, data) { fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2)); }
function id() { return randomUUID(); }
module.exports = { root, output, ssh, remoteNode, adminToken, write, id, remoteEnv };
