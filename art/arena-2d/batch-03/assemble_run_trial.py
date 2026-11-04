"""Deterministic registration of two generated half-cycles; never draws poses."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'raw' / 'fighter-run-se-combined-v3.png'
if OUT.exists():
    raise SystemExit('Refusing to replace existing composite')
canvas = Image.new('RGB', (2048, 1024), '#ff00ff')
records = []
contracts = [
    ('fighter-run-se-v1.png', 2, 4, 0.90, (230, 410), 0),
    ('fighter-run-se-far-half.png', 2, 2, 0.82, (330, 570), 4),
]
for filename, rows, cols, cell_factor, source_anchor, start in contracts:
    im = Image.open(ROOT / 'raw' / filename).convert('RGB')
    scale = 512 / (im.width / cols) * cell_factor
    offset = [round(256 - source_anchor[0] * scale), round(450 - source_anchor[1] * scale)]
    for local in range(4):
        row, col = divmod(local, cols)
        # All four near poses are in source row zero. Far source has two rows.
        box = (round(col * im.width / cols), round(row * im.height / rows),
               round((col + 1) * im.width / cols), round((row + 1) * im.height / rows))
        frame = im.crop(box)
        frame = frame.resize((round(frame.width * scale), round(frame.height * scale)), Image.Resampling.LANCZOS)
        cell = Image.new('RGB', (512, 512), '#ff00ff')
        cell.paste(frame, tuple(offset))
        index = start + local
        canvas.paste(cell, ((index % 4) * 512, (index // 4) * 512))
        records.append({'frame': index, 'source': filename, 'source_box': box,
                        'shared_group_scale': scale, 'shared_group_offset': offset})
canvas.save(OUT)
(ROOT / 'raw' / 'fighter-run-se-combined-v3.registration.json').write_text(
    json.dumps({'method': 'one uniform scale and translation per generated half-cycle, no pose drawing, no per-frame bbox fitting',
                'anchor_px': [256, 450], 'frames': records}, indent=2), encoding='utf-8')
print(OUT)
