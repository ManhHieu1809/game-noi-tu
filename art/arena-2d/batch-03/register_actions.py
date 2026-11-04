"""Uniform whole-action resampling, never per-pose anatomy or bbox fitting."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
contracts = [
    ('fighter-run-se-combined-v3.png', 'fighter-run-se-registered.png', 2, 4, .94, (256, 450)),
    ('fighter-attack-se-v1.png', 'fighter-attack-se-registered.png', 2, 3, .752, (256, 466)),
]
records = []
for src, dst, rows, cols, scale, anchor in contracts:
    dest = ROOT / 'raw' / dst
    if dest.exists():
        raise SystemExit(f'Refusing to replace {dest}')
    image = Image.open(ROOT / 'raw' / src).convert('RGB')
    assert image.size == (cols * 512, rows * 512), image.size
    result = Image.new('RGB', image.size, '#ff00ff')
    offset = (round(256 - anchor[0] * scale), round(426 - anchor[1] * scale))
    for row in range(rows):
        for col in range(cols):
            cell = image.crop((col * 512, row * 512, (col + 1) * 512, (row + 1) * 512))
            cell = cell.resize((round(512 * scale), round(512 * scale)), Image.Resampling.LANCZOS)
            output = Image.new('RGB', (512, 512), '#ff00ff')
            output.paste(cell, offset)
            result.paste(output, (col * 512, row * 512))
    result.save(dest)
    records.append({'source': src, 'output': dst, 'scale': scale, 'offset': offset,
                    'source_root': anchor, 'registered_root': [256, 426],
                    'method': 'one shared scale and translation for every pose of this action'})
(ROOT / 'registration.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print(json.dumps(records))
