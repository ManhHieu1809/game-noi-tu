"""Uniform 50% export of generated/registered sprites for lower-memory playback."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
FORGE=ROOT.parents[2]/'tools/agent-sprite-forge/skills/generate2dsprite/scripts'
sys.path.insert(0,str(FORGE))
import forge_core

catalog=json.loads((ROOT/'final/catalog.json').read_text(encoding='utf-8'))
for asset in catalog['assets']:
    source=ROOT/'final'/asset['id'].removeprefix('fighter-')
    dest=ROOT/'final/lite'/source.name
    if dest.exists():raise SystemExit('Refusing to replace '+str(dest))
    dest.mkdir(parents=True)
    manifest=json.loads((source/'clips-input.json').read_text(encoding='utf-8'))
    manifest['anchor_px']=[x/2 for x in manifest['anchor_px']]
    records=[]
    for name in manifest['frames']:
        src=np.asarray(Image.open(source/name).convert('RGBA'))
        result=forge_core.resample_rgba(src,.5,'lanczos',anchor_src=(0,0),anchor_dst=(0,0),out_size=(192,192))
        result.save(dest/name)
        assert result.mode=='RGBA' and result.getchannel('A').getextrema()==(0,255)
        records.append({'file':str((dest/name).relative_to(ROOT/'final')).replace('\\','/'),
                        'sha256':hashlib.sha256((dest/name).read_bytes()).hexdigest()})
    (dest/'clips-input.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    subprocess.run([sys.executable,str(FORGE/'build_animation_clips.py'),'--manifest',str(dest/'clips-input.json'),
                    '--output-dir',str(dest/'clips'),'--no-reviews','--strict'],check=True)
    asset['lite']={'cell_px':[192,192],'anchor_px':manifest['anchor_px'],'frames':records,
                   'clips':str((dest/'clips/animation-clips.json').relative_to(ROOT/'final')).replace('\\','/')}
catalog['memory_note']={'unique_poses':14,'rgba_384_bytes':14*384*384*4,
                        'rgba_192_bytes':14*192*192*4,
                        'not_included':'Browser overhead, decoded atlases, duplicate previews and GPU copies. No device FPS benchmark.'}
(ROOT/'final/catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
print(json.dumps(catalog['memory_note']))
