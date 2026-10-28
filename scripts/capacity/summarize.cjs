const fs = require('node:fs'); const path = require('node:path');
const { output, write } = require('./lib.cjs');
const tags = process.argv.slice(2); if (!tags.length || tags.some(t=>!/^C\d+_(10|30|60)_(pilot|full)$/.test(t))) throw Error('Exact capacity tags required');
const results = tags.map(tag=>{
  const report=JSON.parse(fs.readFileSync(path.join(output,tag+'-report.json'),'utf8'));
  const raw=fs.readFileSync(path.join(output,tag+'-resources.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const samples=raw.filter(s=>s.containers&&s.stats);
  const percentile=(values,p)=>{const sorted=values.toSorted((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]};
  const cpu=samples.map(s=>s.stats.reduce((sum,c)=>sum+parseFloat(c.CPUPerc),0));
  const resources={samples:samples.length,monitorErrors:raw.filter(s=>s.monitoringError).length,minAvailableMiB:Math.min(...samples.map(s=>s.availableMiB)),minDiskFreeGiB:Math.min(...samples.map(s=>s.diskFreeGiB)),cpuTotalCoresPeak:Math.max(...cpu)/100,cpuTotalCoresP95:percentile(cpu,.95)/100,hostCpuPercentPeak:Math.max(...cpu)/4,unhealthySamples:samples.filter(s=>s.health!==200).length,containerChanges:samples.filter(s=>s.containers.some((c,i)=>c.id!==samples[0].containers[i].id||c.restarts!==samples[0].containers[i].restarts||c.status!=='running')).length};
  const ai=fs.existsSync(path.join(output,tag+'-ai.json'))?JSON.parse(fs.readFileSync(path.join(output,tag+'-ai.json'),'utf8')):null;
  return{tag,users:report.users,mode:report.mode,completed:report.actorsCompleted,elapsedSeconds:report.elapsedSeconds,requests:report.requests,bytes:report.bytes,drafts:report.draftSaves,sideAnswers:report.sideAnswers,feedbacks:report.feedbacks,questionnaires:report.questionnaires,materials:report.materialDownloads,sseConnections:report.sseConnections,sseReconnects:report.sseReconnects,sseRuntimeEvents:report.sseRuntimeEvents,rawErrors:report.errors,failure:report.failure,originalRunRestored:report.originalRunRestored,percentiles:report.percentiles,resources,ai};
});
write('summary.json',results);console.log(JSON.stringify(results.map(({percentiles,ai,...rest})=>({...rest,latencyP95:Object.fromEntries(['login','runtime','draft:save','heartbeat','side:answer'].map(k=>[k,percentiles[k]?.p95])),ai:ai&&{requested:ai.requested,done:ai.done,errors:ai.errors,maxConcurrent:ai.maxConcurrent,results:ai.results}})),null,2));
