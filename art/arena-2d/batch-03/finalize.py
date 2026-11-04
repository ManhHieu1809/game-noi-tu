"""Asset registration/packaging only. All character poses originate in ImageGen."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
FORGE = PROJECT/'tools/agent-sprite-forge/skills/generate2dsprite/scripts'
sys.path.insert(0, str(FORGE))
import scale_frames

FINAL = ROOT/'final'
if FINAL.exists():
    raise SystemExit('Refusing to replace a published asset batch')
FINAL.mkdir()
catalog = {'schema': 'arena.sprite-batch.v1', 'status': 'SE-animation-prototype-with-visual-QA-issues',
           'art_source': 'built-in ImageGen pose sheets; no video', 'character': 'fighter-anime',
           'directions_created': ['SE'], 'all_eight_directions_complete': False,
           'runtime_integrated': False,
           'repository': 'https://github.com/0x0funky/agent-sprite-forge',
           'commit': '5324342fdfab72430f4e9604f3fe427009f8596d', 'assets': []}
for action, prefix, count, cols in [('run-se', 'run', 8, 4), ('attack-se', 'attack', 6, 3)]:
    source = ROOT/'processed'/action
    images = [np.asarray(Image.open(source/f'{prefix}-{i+1}.png').convert('RGBA')) for i in range(count)]
    if prefix == 'run':
        measures = [scale_frames.measure(frame, threshold=16, torso_colors=[(35,94,118),(49,123,146)],
                                          torso_band=(.4,.6), tolerance=30) for frame in images]
        shifts, info = scale_frames.plan_shifts(measures, reference=0, scale=1., root_lock='torso-x',
                                               locks=[], row_baseline=True, row_size=4, quantum=1)
    else:
        # The torso rotates/lunges intentionally in a slash. Keep that authored movement.
        shifts, info = [[0,0]]*count, {'horizontal': None, 'vertical': None, 'reason': 'preserve attack anticipation and lunge'}
    dest = FINAL/action
    dest.mkdir()
    atlas = Image.new('RGBA', (384*cols,384*2))
    outputs = []
    for index, (frame, shift) in enumerate(zip(images, shifts)):
        dx,dy = shift
        output = Image.new('RGBA', (384,384))
        output.paste(Image.fromarray(frame), (dx,dy))
        array = np.asarray(output)
        assert np.count_nonzero(frame[...,3]) == np.count_nonzero(array[...,3]), 'Pixel loss'
        assert not any(np.any(edge) for edge in [array[0,:,3],array[-1,:,3],array[:,0,3],array[:,-1,3]]), 'Edge touch'
        filename = f'{prefix}-{index+1}.png'
        output.save(dest/filename)
        outputs.append(output)
        atlas.paste(output, ((index%cols)*384,(index//cols)*384))
    atlas.save(dest/'sheet.png')
    # GIF preview only: GIF's 10-ms clock rounds a 5-tick gait to 80ms.
    gif = [im.copy() for im in outputs]
    gif[0].save(dest/'preview.gif', save_all=True, append_images=gif[1:], duration=80 if prefix=='run' else [100,120,80,50,80,130],
                loop=0, disposal=2, transparency=0)
    (dest/'registration.json').write_text(json.dumps({'source': f'../../processed/{action}',
        'method': 'Forge scale_frames.measure + plan_shifts; integer translation only, no scaling or anatomy editing',
        'source_anchor_px': [192,365], 'output_anchor_px': [192,365],
        'shifts': shifts, 'lock_info': info, 'all_visible_pixels_preserved': True,
        'per_frame_y_lock': False}, indent=2), encoding='utf-8')
    clip = {'frames': list(range(count)), 'role': 'player'}
    if prefix == 'run':
        clip.update(ticks=5, loop_policy='cycle', events=[{'at':0,'name':'step_r'},{'at':4,'name':'step_l'}])
    else:
        clip.update(ticks=[6,7,5,3,5,8], loop_policy='oneshot', hitstop_ticks=3,
                    keys={'wind_start':0,'wind_peak':2,'strike':3,'recover':4,'end':5},
                    events=[{'at':1,'name':'tell'},{'at':3,'name':'hit'},{'at':4,'name':'active_end'},{'at':5,'name':'end'}])
    manifest = {'schema':'generate2dsprite.animation_clips.v2', 'frames':[f'{prefix}-{i+1}.png' for i in range(count)],
                'anchor_px':[192,365], 'art_source':'host_image', 'sampling':'linear', 'pixel_art':False,
                'clips':{action:clip}, 'states':{'moving' if prefix=='run' else 'attacking':action}}
    (dest/'clips-input.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    subprocess.run([sys.executable,str(FORGE/'build_animation_clips.py'),'--manifest',str(dest/'clips-input.json'),
                    '--output-dir',str(dest/'clips'),'--strict'], check=True)
    entry={'id':f'fighter-{action}', 'action':prefix, 'direction':'SE', 'frame_count':count,
           'cell_px':[384,384], 'anchor_px':[192,365], 'sheet':f'{action}/sheet.png',
           'clips':f'{action}/clips/animation-clips.json', 'gif_preview':f'{action}/preview.gif',
           'status':'prototype; inspect QA report before runtime integration',
           'frames':[{'file':f'{action}/{prefix}-{i+1}.png',
                     'sha256':hashlib.sha256((dest/f'{prefix}-{i+1}.png').read_bytes()).hexdigest()} for i in range(count)]}
    catalog['assets'].append(entry)
(FINAL/'catalog.json').write_text(json.dumps(catalog, indent=2), encoding='utf-8')
print(json.dumps({'catalog':str(FINAL/'catalog.json'),'frames':14,'directions':['SE']}))
