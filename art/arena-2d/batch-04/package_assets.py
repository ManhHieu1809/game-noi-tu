"""Postprocess actual ImageGen art using Forge registration and clip packaging.

No generated pose is scaled independently, warped, painted, or cloned.
"""
from pathlib import Path
import argparse
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
import scale_frames

parser=argparse.ArgumentParser()
parser.add_argument('--output',default='final')
parser.add_argument('--run-source',default='run-se')
args=parser.parse_args()
assert Path(args.output).name==args.output and Path(args.run_source).name==args.run_source
FINAL=ROOT/args.output
if FINAL.exists():raise SystemExit('Refusing to replace final assets')
FINAL.mkdir()
catalog={'schema':'arena.sprite-batch.v2','character':'fighter-anime','directions':['SE'],
         'status':'revised SE run and slash; raw diagnostic caveats retained',
         'eight_directions_complete':False,'runtime_integrated':False,
         'repository':'https://github.com/0x0funky/agent-sprite-forge',
         'commit':'5324342fdfab72430f4e9604f3fe427009f8596d','license':'MIT (toolchain)',
         'generation':'built-in ImageGen; image poses, no video','assets':[]}
for action,prefix,count,cols in [('run-se','run',8,4),('attack-se','attack',6,3)]:
    source=ROOT/'processed'/(args.run_source if prefix=='run'else action)
    frames=[np.asarray(Image.open(source/f'{prefix}-{i+1}.png').convert('RGBA'))for i in range(count)]
    measures=[scale_frames.measure(f,threshold=16,torso_colors=[(35,94,118),(49,123,146)] if prefix=='run' else [],
                                   torso_band=(.4,.6),tolerance=30)for f in frames]
    ref=measures[0]
    for f,m in zip(frames,measures):
        m['hip_x']=scale_frames.hip_x(forge_core.subject_mask(f[...,3],16),ref['ground'],ref['height'])
    shifts,lock_info=scale_frames.plan_shifts(measures,reference=0,scale=1,
        root_lock='torso-x' if prefix=='run'else'none',locks=[]if prefix=='run'else['hip'],
        row_baseline=False,row_size=cols,quantum=1)
    dest=FINAL/action;dest.mkdir()
    atlas=Image.new('RGBA',(384*cols,768))
    output=[]
    for i,(f,shift)in enumerate(zip(frames,shifts)):
        im=Image.new('RGBA',(384,384));im.paste(Image.fromarray(f),tuple(shift))
        a=np.asarray(im)
        assert np.count_nonzero(a[...,3])==np.count_nonzero(f[...,3]),'lost source pixels'
        assert not any(np.any(edge)for edge in[a[0,:,3],a[-1,:,3],a[:,0,3],a[:,-1,3]]),'edge touch'
        im.save(dest/f'{prefix}-{i+1}.png');output.append(im)
        atlas.paste(im,((i%cols)*384,(i//cols)*384))
    atlas.save(dest/'sheet.png')
    (dest/'registration.json').write_text(json.dumps({'method':'unmodified Forge measure/hip_x/plan_shifts; whole-pixel horizontal translations only',
        'shifts':shifts,'lock_info':lock_info,'anchor_px':[192,365],
        'scale_per_frame':False,'vertical_pinning':False,'all_visible_pixels_retained':True},indent=2),encoding='utf-8')
    # PNG/WebP is authoritative. GIF can only store multiples of 10ms.
    gif_durations=[70,60,70,70,60,70,70,60]if prefix=='run'else[80,100,70,50,80,120]
    output[0].save(dest/'preview.gif',save_all=True,append_images=output[1:],duration=gif_durations,loop=0,disposal=2,transparency=0)
    clip={'frames':list(range(count)),'role':'player'}
    if prefix=='run':clip.update(ticks=4,loop_policy='cycle',events=[{'at':0,'name':'step_r'},{'at':4,'name':'step_l'}])
    else:clip.update(ticks=[5,6,4,3,5,7],loop_policy='oneshot',hitstop_ticks=3,
        keys={'wind_start':0,'wind_peak':2,'strike':3,'recover':4,'end':5},
        events=[{'at':1,'name':'tell'},{'at':3,'name':'hit'},{'at':4,'name':'active_end'},{'at':5,'name':'end'}])
    manifest={'schema':'generate2dsprite.animation_clips.v2','frames':[f'{prefix}-{i+1}.png'for i in range(count)],
        'anchor_px':[192,365],'art_source':'host_image','pixel_art':False,'sampling':'linear',
        'clips':{action:clip},'states':{'moving'if prefix=='run'else'attacking':action}}
    variants=[]
    for size in [384,192]:
        folder=dest if size==384 else FINAL/'lite'/action
        folder.mkdir(parents=True,exist_ok=True)
        if size==192:
            for i,im in enumerate(output):
                forge_core.resample_rgba(np.asarray(im),.5,'lanczos',anchor_src=(0,0),anchor_dst=(0,0),out_size=(192,192)).save(folder/f'{prefix}-{i+1}.png')
        doc=json.loads(json.dumps(manifest))
        doc['anchor_px']=[v*(size/384)for v in doc['anchor_px']]
        (folder/'clips-input.json').write_text(json.dumps(doc,indent=2),encoding='utf-8')
        subprocess.run([sys.executable,str(FORGE/'build_animation_clips.py'),'--manifest',str(folder/'clips-input.json'),
                        '--output-dir',str(folder/'clips'),'--strict',*(['--no-reviews']if size==192 else[])],check=True)
        paths=[folder/f'{prefix}-{i+1}.png'for i in range(count)]
        variants.append({'size':size,'anchor_px':doc['anchor_px'],
            'frames':[{'path':p.relative_to(FINAL).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size}for p in paths],
            'clips':(folder/'clips/animation-clips.json').relative_to(FINAL).as_posix()})
    catalog['assets'].append({'id':f'fighter-{action}','action':prefix,'facing':'SE','frames':count,
                              'ticks':clip['ticks'],'loop_policy':clip['loop_policy'],'variants':variants})
(FINAL/'catalog.json').write_text(json.dumps(catalog,indent=2),encoding='utf-8')
print(FINAL/'catalog.json')
