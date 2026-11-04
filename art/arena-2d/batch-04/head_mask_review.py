"""Calibrated head-only DIAGNOSTIC masks. Never changes deliverable frames.

The general Forge band includes raised weapons/scarves. Review separate colour-
segmented head crops with an explicitly bounded ROI and retain the original report.
"""
from pathlib import Path
import argparse
import json
import sys
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parent
FORGE=ROOT.parents[2]/'tools/agent-sprite-forge/skills/generate2dsprite/scripts'
sys.path.insert(0,str(FORGE))
import forge_core
import sheet_qc

parser=argparse.ArgumentParser();parser.add_argument('--run-source',default='run-se');parser.add_argument('--suffix',default='');args=parser.parse_args()
assert Path(args.run_source).name==args.run_source
assert all(c.isalnum() or c=='-'for c in args.suffix)

for action,prefix,count,roi in [('run-se','run',8,(180,145,244,207)),('attack-se','attack',6,(174,150,233,215))]:
    out=ROOT/'qa'/f'{action}-head-only{args.suffix}'
    out.mkdir(exist_ok=True)
    frames=[];metrics=[]
    review=Image.new('RGB',(4*264,2*312),'#cfd7dd');draw=ImageDraw.Draw(review)
    for index in range(count):
        source=ROOT/'processed'/(args.run_source if prefix=='run'else action)/f'{prefix}-{index+1}.png'
        im=Image.open(source).convert('RGBA');a=np.asarray(im);rgb=a[...,:3].astype(float)
        r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
        hair=(r<175)&(b>r*1.02)&(b>g*1.02)
        skin=(r>125)&(g>r*.68)&(b>g*.5)&(b<g*.93)&(r-g>12)
        region=np.zeros(a.shape[:2],bool);x0,y0,x1,y1=roi;region[y0:y1,x0:x1]=True
        mask=(hair|skin)&region&(a[...,3]>127)
        # Only the connected head: blade and small detached antialias pixels are excluded.
        labels,number=forge_core.label_components(mask,8)
        sizes=np.bincount(labels.ravel());sizes[0]=0
        chosen=labels==int(np.argmax(sizes))
        diagnostic=a.copy();diagnostic[~chosen]=0
        frames.append(diagnostic)
        Image.fromarray(diagnostic).save(out/f'head-{index+1}.png')
        ys,xs=np.nonzero(chosen)
        metrics.append({'frame':index,'roi':roi,'bbox':[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)],
                        'source':str(source.relative_to(ROOT))})
        x,y=(index%4)*264,(index//4)*312
        original=im.crop(roi).resize((264,292),Image.Resampling.NEAREST)
        isolated=Image.fromarray(diagnostic).crop(roi).resize((264,292),Image.Resampling.NEAREST)
        review.paste(isolated,(x,y+20),isolated)
        draw.text((x+4,y+3),f'{prefix}-{index+1}: head-only mask',fill='#182734')
    ratios=sheet_qc.head_ratios(frames,head_frac=1.0)
    report={'method':'Bounded ROI, navy hair / warm skin mask, largest 8-connected component; inspection only, art unmodified',
            'notProven':['Mask completeness and actual skull dimensions require visual inspection.',
                         'This does not override the original full-band Forge diagnostic.'],
            'metrics':metrics,'ratios':ratios}
    (out/'head-analysis.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    review.save(out/'mask-review.png')
    print(action,json.dumps(ratios))
