import sys, json, zipfile, pathlib, re, datetime, hashlib
tag=sys.argv[1]
if not re.fullmatch(r'C\d+_(10|30|60)_(pilot|full)',tag): raise ValueError('Exact capacity tag required')
root=pathlib.Path(__file__).resolve().parents[2]/'output'/'capacity-20261028'
manifest=json.loads((root/(tag+'-manifest.json')).read_text(encoding='utf-8'))
codes={actor['sessionCode'] for actor in manifest['actors']}
checks=[]
def check(name, passed, detail=None): checks.append(dict(name=name,passed=bool(passed),detail=detail))
with zipfile.ZipFile(root/(tag+'-export.zip')) as archive:
    names=archive.namelist()
    check('ZIP CRC integrity',archive.testzip() is None)
    sessions={parts[1] for name in names if len(parts:=name.split('/'))>2 and parts[0]=='sessions'}
    check('export scope exactly matches requested teams',sessions==codes,sorted(sessions))
    for suffix in ['participant_metadata.json','variables.json','online_integrity.json']:
        found=[name for name in names if name.endswith('/'+suffix)]
        check('one '+suffix+' per participant',len(found)==manifest['users'],len(found))
    shared=[name for name in names if name.endswith('/session_metadata.json')]
    check('one shared metadata per team',len(shared)==manifest['users']//2,len(shared))
    json_count=0;inline=[];summaries=[];variables=[];segments=[]
    for name in names:
        if name.endswith(('.json','.jsonl')):
            content=archive.read(name).decode('utf-8-sig')
            if re.search(r'data:image/[^;]+;base64,',content):inline.append(name)
            if name.endswith('.json'):
                parsed=json.loads(content)
                if name.endswith('/variables.json'):variables.append(parsed)
                if name.endswith('/segment_metadata.json') and '/formal_segments/' in name:segments.append(parsed)
            else:
                for line in content.splitlines():
                    if line.strip():json.loads(line)
            json_count+=1
            if 'variable_implementation_summary' in name:summaries.append(name)
    check('all JSON and JSONL parse',json_count>0,json_count)
    check('no embedded base64 images in JSON',not inline,inline)
    check('dynamic implementation summary exists',bool(summaries),summaries)
    if summaries:
        summary=json.loads(archive.read(summaries[0]))
        check('dynamic summary has no risks or missing sources',not summary.get('risks') and not summary.get('missingSource'),{key:summary.get(key) for key in ['risks','missingSource']})
    check('no path traversal entries',all(not name.startswith('/') and '..' not in name.split('/') for name in names))
    if manifest['mode']=='full':
        formal_surveys=[name for name in names if re.search(r'/questionnaires/(segment_[123]|post_survey)\.json$',name)]
        check('four formal questionnaire files per participant',len(formal_surveys)==manifest['users']*4,len(formal_surveys))
        check('three completed personal instructions per participant',all(v['instructions']['completedCount']==3 and len(v['instructions']['bySegment'])==3 and all(i['completed'] and i['viewDurationSeconds']>=15 for i in v['instructions']['bySegment']) for v in variables))
        def timestamp(value):return datetime.datetime.fromisoformat(value.replace('Z','+00:00'))
        check('all personal formal segments export actual end times',len(segments)==manifest['users']*3 and all(s.get('endedAt') and 0<=(timestamp(s['endedAt'])-timestamp(s['plannedEndsAt'])).total_seconds()<30 and (timestamp(s['plannedEndsAt'])-timestamp(s['startedAt'])).total_seconds()==1200 for s in segments),len(segments))
        report=json.loads((root/(tag+'-report.json')).read_text(encoding='utf-8'))
        expected_images=sum(bool(result.get('image')) for result in (report.get('ai') or {}).get('results',[]))
        images=[name for name in names if '/attachments/images/' in name and not name.endswith('/')]
        check('all sent AI image files included',len(images)==expected_images,len(images))
        original=root.parent/'playwright'/'capacity-ui-offline.png'
        if expected_images and original.exists():
            digest=hashlib.sha256(original.read_bytes()).digest()
            check('exported image bytes match sent screenshot',all(hashlib.sha256(archive.read(name)).digest()==digest for name in images))
    receipt=dict(tag=tag,files=len(names),checks=checks,passed=sum(c['passed'] for c in checks),total=len(checks),imageFiles=sum('/attachments/images/' in name and not name.endswith('/') for name in names))
(root/(tag+'-export-audit.json')).write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False))
sys.exit(0 if receipt['passed']==receipt['total'] else 1)
