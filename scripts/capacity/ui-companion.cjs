const fs=require('node:fs'),path=require('node:path');const{output,write}=require('./lib.cjs');
const manifest=JSON.parse(fs.readFileSync(path.join(output,'ui-manifest.json'),'utf8'));
if(!manifest.tag.startsWith('CAPACITY_UI_'))throw Error('Own UI scope missing');
const a=manifest.boots.find(x=>x.role==='A'); const deadline=Date.now()+25*60000;
const wait=ms=>new Promise(r=>setTimeout(r,ms)); const events=[];let formalReady=false,openedAt=null,completed=false,lastHeartbeat=0;
async function post(route,data){const r=await fetch(`https://aiseek.tech/api/experiment/session/${a.sessionCode}`+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(route+' HTTP '+r.status());return r.json()}
(async()=>{try{while(Date.now()<deadline){const r=await fetch(`https://aiseek.tech/api/experiment/session/${a.sessionCode}/runtime?participantId=${a.participantId}`).then(r=>r.json());
if(r.phase==='end')break;
if(r.phase==='formal_ready'&&!formalReady){for(const b of manifest.boots){await post('/integrity/commitment',{participantId:b.participantId,accepted:true,answers:{formalOnly:true,offscreenRule:true,dropoutRule:true,privacyRule:true}});await post('/ready-formal',{participantId:b.participantId})}formalReady=true;}
if(r.phase==='pre_segment_instruction'&&!openedAt){for(const b of manifest.boots)await post('/pre-segment-instruction/open',{participantId:b.participantId});openedAt=Date.now();}
if(r.phase==='pre_segment_instruction'&&openedAt&&Date.now()-openedAt>16000&&!completed){for(const b of manifest.boots)await post('/pre-segment-instruction/complete',{participantId:b.participantId});completed=true;events.push({at:new Date().toISOString(),phase:'formal_work'});console.log('UI formal started',a.sessionCode);}
if(r.phase==='formal_work'&&Date.now()-lastHeartbeat>9000){await post('/integrity/heartbeat',{participantId:a.participantId,lastValidActivityAt:new Date().toISOString(),clientTime:new Date().toISOString()});lastHeartbeat=Date.now();}
await wait(2000);}}finally{await post('/integrity/quit',{participantId:a.participantId,reason:'capacity_ui_companion_finished'}).catch(()=>undefined);write(manifest.tag+'-companion.json',{sessionCode:a.sessionCode,events,endedAt:new Date().toISOString()})}})().catch(e=>{console.error(e.message);process.exitCode=1});
