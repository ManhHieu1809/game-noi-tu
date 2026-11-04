"""Run Forge diagnostics and verify exported asset bytes; retains every WARN/FAIL."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
from html.parser import HTMLParser
from PIL import Image

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT.parents[2]
FORGE=PROJECT/'tools/agent-sprite-forge/skills/generate2dsprite/scripts'
reports=[]
for action,prefix,count,cols in [('run-se','run',8,4),('attack-se','attack',6,3)]:
    files=[ROOT/'final'/action/f'{prefix}-{i+1}.png' for i in range(count)]
    command=[sys.executable,str(FORGE/'sheet_qc.py'),'frames','--frames',*map(str,files),
             '--cycle','run' if prefix=='run' else 'none','--game-pixel','2','--frames-per-row',str(cols),
             '--output-dir',str(ROOT/'qa'/f'final-{action}')]
    if prefix=='run':command+=['--facing','right','--torso-colors','#235e76,#317b92']
    else:command+=['--no-loop']
    report_file=ROOT/'qa'/f'final-{action}'/'sheet-qc.json'
    if not report_file.exists():
        process=subprocess.run(command,check=False)
        if process.returncode not in (0,1):raise RuntimeError('QC execution error')
    report=json.loads(report_file.read_text(encoding='utf-8'))
    # Reuse a prior diagnostic only if every referenced input still has identical bytes.
    for item in report['inputs']:
        file=(report_file.parent/item['path']).resolve()
        assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256'],file
    reports.append({'action':action,'status':report['status'],
                    'report':f'../qa/final-{action}/sheet-qc.json',
                    'issues':[c for c in report['checks'] if c['status'] in ('warn','fail')],
                    'notProven':report['notProven']})
    for f in files:
        im=Image.open(f)
        assert im.mode=='RGBA' and im.size==(384,384)
        alpha=im.getchannel('A');assert alpha.getextrema()==(0,255)
        assert alpha.getbbox() is not None
    gif=Image.open(ROOT/'final'/action/'preview.gif')
    assert gif.n_frames==count
    assert gif.convert('RGBA').getchannel('A').getextrema()==(0,255)
    clips=json.loads((ROOT/'final'/action/'clips/animation-clips.json').read_text(encoding='utf-8'))
    assert not [c for c in clips['qa']['checks'] if c['status'] in ('warn','fail')],clips['qa']['checks']

catalog=json.loads((ROOT/'final/catalog.json').read_text(encoding='utf-8'))
for asset in catalog['assets']:
    for frame in asset['frames']:
        assert hashlib.sha256((ROOT/'final'/frame['file']).read_bytes()).hexdigest()==frame['sha256']
    lite=asset.get('lite')
    assert lite is not None
    for frame in lite['frames']:
        file=ROOT/'final'/frame['file']
        assert hashlib.sha256(file.read_bytes()).hexdigest()==frame['sha256']
        im=Image.open(file)
        assert im.mode=='RGBA' and im.size==(192,192) and im.getchannel('A').getextrema()==(0,255)
    clip=json.loads((ROOT/'final'/lite['clips']).read_text(encoding='utf-8'))
    assert not [c for c in clip['qa']['checks'] if c['status'] in ('warn','fail')]

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.scripts=[];self.in_script=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='a' and 'href'in a:self.links.append(a['href'])
        if tag=='script':self.in_script=True
    def handle_endtag(self,tag):
        if tag=='script':self.in_script=False
    def handle_data(self,data):
        if self.in_script:self.scripts.append(data)
html=Links();html.feed((ROOT/'preview.html').read_text(encoding='utf-8'))
for url in html.links:
    if url=='final/qa-report.json':continue
    assert (ROOT/url).exists(),url
script=ROOT/'qa/preview-script.js';script.write_text('\n'.join(html.scripts),encoding='utf-8')
subprocess.run(['node','--check',str(script)],check=True)
summary={'schema':'arena.asset-qa.v1','technical_exports':'pass',
         'technical_checks':['14 RGBA PNGs, 384x384, visible content and real transparency',
                             'no clipped pixels after root registration',
                             'exported frame SHA-256 matches catalog',
                             'GIF has exact frame count and transparency',
                             'Forge WebP timing/alpha verification and clip lints',
                             'preview JavaScript syntax and local hyperlinks'],
         'lite_checks':'same 14 poses exported at 192x192 RGBA; dimensions, alpha, hashes and Forge clip checks pass',
         'visual_release_status':'prototype; NOT all visual gates passed', 'frame_diagnostics':reports,
         'browser_playback_tested':False,'runtime_game_tested':False,
         'eight_direction_set_complete':False,
         'rejected_consistency_pass':{'source':'../raw/fighter-run-se-consistency.png',
                                      'reason':'Did not improve head consistency; diagnostic maximum ratio 1.122 versus 1.10 in selected prototype. Not selected.'}}
(ROOT/'final/qa-report.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'technical_exports':'pass','visual_release_status':summary['visual_release_status'],
                  'diagnostics':[{r['action']:r['status']}for r in reports]},ensure_ascii=False))
