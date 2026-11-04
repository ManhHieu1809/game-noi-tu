"""Validate published assets, retain Forge warnings, and check preview syntax."""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import hashlib
import json
import subprocess
import sys
from PIL import Image

ROOT=Path(__file__).resolve().parent
FORGE=ROOT.parents[2]/'tools/agent-sprite-forge/skills/generate2dsprite/scripts'
parser=argparse.ArgumentParser();parser.add_argument('--bundle',default='final');parser.add_argument('--head-suffix',default='');args=parser.parse_args()
assert Path(args.bundle).name==args.bundle
BUNDLE=ROOT/args.bundle
catalog=json.loads((BUNDLE/'catalog.json').read_text(encoding='utf-8'))
diagnostics=[]
for asset in catalog['assets']:
    for variant in asset['variants']:
        size=variant['size']
        for record in variant['frames']:
            f=BUNDLE/record['path'];assert hashlib.sha256(f.read_bytes()).hexdigest()==record['sha256']
            im=Image.open(f);assert im.mode=='RGBA' and im.size==(size,size)
            alpha=im.getchannel('A');assert alpha.getextrema()==(0,255)
            box=alpha.getbbox();assert box and min(box)>0 and max(box)<size
        clip=json.loads((BUNDLE/variant['clips']).read_text(encoding='utf-8'))
        assert not [c for c in clip['qa']['checks']if c['status']in('warn','fail')]
        assert clip['anchor_px']==variant['anchor_px']
    action=asset['action']+'-se';prefix=asset['action'];count=asset['frames']
    gif=Image.open(BUNDLE/action/'preview.gif');assert gif.n_frames==count
    assert gif.convert('RGBA').getchannel('A').getextrema()==(0,255)
    dest=ROOT/'qa'/f'{args.bundle}-{action}'
    if not dest.exists():
        command=[sys.executable,str(FORGE/'sheet_qc.py'),'frames','--frames',
                 *[str(BUNDLE/action/f'{prefix}-{i+1}.png')for i in range(count)],
                 '--cycle','run'if prefix=='run'else'none','--game-pixel','2',
                 '--frames-per-row','4'if prefix=='run'else'3','--output-dir',str(dest)]
        command+=['--facing','right','--torso-colors','#235e76,#317b92']if prefix=='run'else['--no-loop']
        result=subprocess.run(command,check=False)
        assert result.returncode in(0,1)
    report=json.loads((dest/'sheet-qc.json').read_text(encoding='utf-8'))
    for entry in report['inputs']:
        p=(dest/entry['path']).resolve();assert hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256']
    diagnostics.append({'action':action,'status':report['status'],
        'report':str((dest/'sheet-qc.json').relative_to(ROOT)),
        'issues':[c for c in report['checks']if c['status']in('warn','fail')]})

class Page(HTMLParser):
    def __init__(self):super().__init__();self.javascript=[];self.active=False
    def handle_starttag(self,tag,attrs):
        if tag=='script':self.active=True
    def handle_endtag(self,tag):
        if tag=='script':self.active=False
    def handle_data(self,data):
        if self.active:self.javascript.append(data)
p=Page();p.feed((ROOT/'preview.html').read_text(encoding='utf-8'))
javascript='\n'.join(p.javascript)
assert javascript.strip()
(ROOT/'qa/preview-script.js').write_text(javascript,encoding='utf-8')
# stdin avoids Node's unrelated Windows realpath lookup of parent user folders.
subprocess.run(['node','--check','--input-type=module'],input=javascript,encoding='utf-8',check=True)
head_checks=[]
for action in ['run-se','attack-se']:
    report=json.loads((ROOT/'qa'/f'{action}-head-only{args.head_suffix}/head-analysis.json').read_text(encoding='utf-8'))
    ratios=[f['head_ratio']for f in report['ratios']['frames']]
    head_checks.append({'action':action,'ratio_range':[min(ratios),max(ratios)],
                       'method':report['method'],'limitations':report['notProven']})
for which,base in [('before',ROOT.parent/'batch-03/final'),('after',BUNDLE)]:
    for size in[192,384]:
        for prefix,count in[('run',8),('attack',6)]:
            for i in range(count):
                p=base/('lite'if size==192 else'')/(prefix+'-se')/f'{prefix}-{i+1}.png'
                assert p.exists(),p

# Calibrate locomotion to this camera and the actual near/far boot palettes.
# The default auto method samples only the bottom 18%, which contains one foot
# in these elevated SE poses. Keep both reports; do not relax identity thresholds.
camera_dest=ROOT/'qa'/f'{args.bundle}-run-camera'
if not camera_dest.exists():
    subprocess.run([sys.executable,str(FORGE/'sheet_qc.py'),'frames','--frames',
        *[str(BUNDLE/'run-se'/f'run-{i+1}.png')for i in range(8)],
        '--cycle','run','--facing','right','--game-pixel','2','--frames-per-row','4',
        '--near-colors','#d8b8b8,#c8a8a8,#c8a8b8','--far-colors','#887888,#685868,#786878',
        '--colour-tol','24','--leg-band','0.65','--torso-colors','#235e76,#317b92',
        '--output-dir',str(camera_dest)],check=False)
camera_report=json.loads((camera_dest/'sheet-qc.json').read_text(encoding='utf-8'))
camera_checks=[c for c in camera_report['checks']if c['id']in('phase_coverage','leg_alternation','torso_drift','row_baseline','seam')]
summary={'schema':'arena.asset-qa.v2','technical_exports':'pass',
         'unique_poses':14,'sizes':[384,192],'png_hashes_and_alpha':'pass',
         'clip_builder_strict':'pass: all four exports; WebP timing, alpha and PNG bytes verified',
         'preview_javascript_syntax':'pass','browser_playback_verified':False,
         'browser_blocker':'CUA initialization failed to write kernel assets: OS error 3; browser host unavailable earlier',
         'raw_forge_diagnostics':diagnostics,'head_only_diagnostics':head_checks,
         'camera_calibrated_run':{'method':'same Forge checker, declared sampled boot colours, leg band 65% to include both feet in elevated SE projection',
                                  'report':str((camera_dest/'sheet-qc.json').relative_to(ROOT)),
                                  'status':camera_report['status'],'checks':camera_checks},
         'visual_review':'Looked at full action sheets and enlarged head crops; contact phases are clearer; compare in preview.html',
         'release_status':'revised SE asset bundle; automated raw visual warnings remain, not an all-pass eight-direction set',
         'game_integrated':False,'eight_direction_set_complete':False}
(BUNDLE/'qa-report.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'technical_exports':'pass','diagnostics':diagnostics},ensure_ascii=False))
