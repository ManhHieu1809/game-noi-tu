"""Uniform registration of ImageGen sheets, no anatomical edits or per-pose fitting."""
from pathlib import Path
import argparse
import json
from PIL import Image

ROOT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--action',choices=['run','attack'],required=True)
parser.add_argument('--factor',type=float,required=True)
parser.add_argument('--source-anchor-y',type=float,required=True)
parser.add_argument('--suffix',default='')
parser.add_argument('--source-file')
args=parser.parse_args()
cols=4 if args.action=='run' else 3
if args.source_file:
    assert Path(args.source_file).name==args.source_file
source=ROOT/'raw'/(args.source_file or f'{args.action}-se-guided-v1.png')
assert all(c.isalnum() or c=='-' for c in args.suffix)
destination=ROOT/f'raw/{args.action}-se-registered{args.suffix}.png'
if destination.exists():raise SystemExit('Refusing to replace '+str(destination))
im=Image.open(source).convert('RGB');original=im.size
assert abs(im.width/im.height-cols/2)<.005
im=im.resize((512*cols,1024),Image.Resampling.LANCZOS)
result=Image.new('RGB',im.size,'#ff00ff')
offset=(round(256-256*args.factor),round(414-args.source_anchor_y*args.factor))
for index in range(cols*2):
    row,col=divmod(index,cols)
    cell=im.crop((col*512,row*512,(col+1)*512,(row+1)*512))
    cell=cell.resize((round(512*args.factor),round(512*args.factor)),Image.Resampling.LANCZOS)
    output=Image.new('RGB',(512,512),'#ff00ff');output.paste(cell,offset)
    result.paste(output,(col*512,row*512))
result.save(destination)
(ROOT/f'{args.action}-registration{args.suffix}.json').write_text(json.dumps({
    'source':str(source.relative_to(ROOT)),'original_size':original,
    'normalized_size':im.size,'whole_action_scale':args.factor,'whole_action_offset':offset,
    'source_anchor':[256,args.source_anchor_y],'registered_anchor':[256,414],
    'per_frame_rescale':False,'per_frame_root_shift':False,
},indent=2),encoding='utf-8')
print(destination)
