const fs = require('node:fs');
const path = require('node:path');
const { ssh, output } = require('./lib.cjs');
const tag = process.argv[2]; if (!/^[A-Za-z0-9_-]+$/.test(tag || '')) throw Error('Missing monitor tag');
const stopFile = path.join(output, `${tag}.stop`);
const doneFile = path.join(output, `${tag}.done`);
const samples = path.join(output, `${tag}-resources.jsonl`);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let baseline; let healthFailures = 0; let monitorFailures = 0;
async function main() {
  while (!fs.existsSync(doneFile) && !fs.existsSync(stopFile)) {
    try {
      const raw = ssh(`set -e
printf '{"availableMiB":'; awk '/MemAvailable/{printf "%d", $2/1024}' /proc/meminfo
printf ',"diskFreeGiB":'; df -Pk / | awk 'NR==2{printf "%d", $4/1024/1024}'
printf ',"containers":['
docker inspect --format '{"name":{{json .Name}},"id":{{json .Id}},"restarts":{{.RestartCount}},"status":{{json .State.Status}}}' multi_cooperation_server_prod multi_cooperation_postgres_prod multi_cooperation_web_prod multi_cooperation_nginx_prod | paste -sd, -
printf '],"stats":['
docker stats --no-stream --format '{{json .}}' multi_cooperation_server_prod multi_cooperation_postgres_prod multi_cooperation_web_prod multi_cooperation_nginx_prod | paste -sd, -
printf ']}'
`, 20000);
      const sample = { at: new Date().toISOString(), ...JSON.parse(raw) };
      monitorFailures = 0;
      if (!baseline) baseline = sample.containers;
      const health = await fetch('https://aiseek.tech/api/health', { signal: AbortSignal.timeout(5000) }).catch(() => null);
      healthFailures = health?.ok ? 0 : healthFailures + 1;
      fs.appendFileSync(samples, JSON.stringify({ ...sample, health: health?.status ?? 'unreachable' }) + '\n');
      const reasons = [];
      if (sample.availableMiB < 1024) reasons.push('available memory below 1GiB');
      if (sample.diskFreeGiB < 10) reasons.push('free disk below 10GiB');
      if (healthFailures >= 2) reasons.push('two consecutive health failures');
      for (const container of sample.containers) {
        const original = baseline.find((item) => item.name === container.name);
        if (container.status !== 'running' || container.restarts !== original.restarts || container.id !== original.id) reasons.push(`container changed/restarted: ${container.name}`);
      }
      if (reasons.length) { fs.writeFileSync(stopFile, reasons.join('; ')); return; }
    } catch (error) {
      monitorFailures++;
      fs.appendFileSync(samples, JSON.stringify({ at: new Date().toISOString(), monitoringError: error.message.slice(0, 300) }) + '\n');
      if (monitorFailures >= 2) { fs.writeFileSync(stopFile, 'Resource monitor unavailable twice; stopping conservatively'); return; }
    }
    await pause(8000);
  }
}
main().catch((error) => { fs.writeFileSync(stopFile, 'Monitor failed: ' + error.message); process.exitCode = 1; });
