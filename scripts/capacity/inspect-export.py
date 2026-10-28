import sys, json, zipfile, pathlib, re
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
    json_count=0;inline=[];summaries=[]
    for name in names:
        if name.endswith(('.json','.jsonl')):
            content=archive.read(name).decode('utf-8-sig')
            if re.search(r'data:image/[^;]+;base64,',content):inline.append(name)
            if name.endswith('.json'): parsed=json.loads(content)
            else:
                for line in content.splitlines():
                    if line.strip():json.loads(line)
            json_count+=1
            if 'variable_implementation_summary' in name:summaries.append(name)
    check('all JSON and JSONL parse',json_count>0,json_count)
    check('no embedded base64 images in JSON',not inline,inline)
    check('dynamic implementation summary exists',bool(summaries),summaries)
    check('no path traversal entries',all(not name.startswith('/') and '..' not in name.split('/') for name in names))
    receipt=dict(tag=tag,files=len(names),checks=checks,passed=sum(c['passed'] for c in checks),total=len(checks),imageFiles=sum('/attachments/images/' in name and not name.endswith('/') for name in names))
(root/(tag+'-export-audit.json')).write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False))
sys.exit(0 if receipt['passed']==receipt['total'] else 1)
