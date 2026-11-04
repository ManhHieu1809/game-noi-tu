"""Diagnostic enlargement of actual generated PNGs; no asset modifications."""
from pathlib import Path
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parent
(ROOT/'qa').mkdir(exist_ok=True)
for action,prefix,count in [('run-se','run',8),('attack-se','attack',6)]:
    sheet=Image.new('RGB',(4*330,2*350),'#d2d9df');d=ImageDraw.Draw(sheet)
    for i in range(count):
        im=Image.open(ROOT/'processed'/action/f'{prefix}-{i+1}.png').convert('RGBA')
        crop=im.crop((160,125,270,235)).resize((330,330),Image.Resampling.NEAREST)
        x,y=(i%4)*330,(i//4)*350
        sheet.paste(crop,(x,y+20),crop)
        d.text((x+8,y+3),f'{prefix}-{i+1} / source (160,125)-(270,235), 3x',fill='#182734')
    sheet.save(ROOT/'qa'/f'{action}-heads-review.png')
