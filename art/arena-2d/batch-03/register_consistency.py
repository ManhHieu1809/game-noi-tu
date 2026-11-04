from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
source = ROOT / 'raw/fighter-run-se-consistency.png'
dest = ROOT / 'raw/fighter-run-se-consistency-registered.png'
if dest.exists():
    raise SystemExit('Refusing to replace existing output')
im = Image.open(source).convert('RGB')
assert im.width == im.height * 2
original_size = im.size
im = im.resize((2048, 1024), Image.Resampling.LANCZOS)
out = Image.new('RGB', im.size, '#ff00ff')
for index in range(8):
    row, col = divmod(index, 4)
    cell = im.crop((col*512, row*512, (col+1)*512, (row+1)*512))
    cell = cell.resize((481, 481), Image.Resampling.LANCZOS)
    slot = Image.new('RGB', (512, 512), '#ff00ff')
    slot.paste(cell, (15, 3))
    out.paste(slot, (col*512, row*512))
out.save(dest)
(ROOT/'consistency-registration.json').write_text(json.dumps({
    'source': str(source.relative_to(ROOT)), 'original_size': original_size,
    'whole_sheet_normalized_size': [2048,1024], 'cell_resize': [481,481],
    'shared_offset': [15,3], 'declared_root': [256,426],
    'per_frame_bbox_fit': False, 'per_frame_reanchor': False,
}, indent=2), encoding='utf-8')
