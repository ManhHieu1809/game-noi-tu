"""Package generated PNG frames through Forge; no creative image generation."""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
BUILDER = PROJECT / 'tools/agent-sprite-forge/skills/generate2dsprite/scripts/build_animation_clips.py'
actions = [
    ('run-se', 'run', 8, {'ticks': 5, 'loop_policy': 'cycle', 'role': 'player',
                        'events': [{'at': 0, 'name': 'step_r'}, {'at': 4, 'name': 'step_l'}]}),
    ('attack-se', 'attack', 6, {'ticks': [6, 7, 5, 3, 5, 8], 'loop_policy': 'oneshot', 'role': 'player',
                             'keys': {'wind_start': 0, 'wind_peak': 2, 'strike': 3, 'recover': 4, 'end': 5},
                             'events': [{'at': 1, 'name': 'tell'}, {'at': 3, 'name': 'hit'},
                                        {'at': 4, 'name': 'active_end'}, {'at': 5, 'name': 'end'}],
                             'hitstop_ticks': 3}),
]
for action, prefix, count, clip in actions:
    source = ROOT / 'processed' / action
    meta = json.loads((source / 'pipeline-meta.json').read_text(encoding='utf-8'))
    assert meta['geometry']['injected_shift_px'] == {'x': [0.0, 0.0], 'y': [0.0, 0.0]}
    assert all(not f['is_empty'] and not f['paste_clamped'] and not f['edge_touch'] for f in meta['frames'])
    clip['frames'] = list(range(count))
    manifest = {
        'schema': 'generate2dsprite.animation_clips.v2',
        'frames': [f'{prefix}-{i + 1}.png' for i in range(count)],
        'anchor_px': meta['frames'][0]['anchor_target'],
        'art_source': 'host_image', 'pixel_art': False, 'sampling': 'linear',
        'clips': {action: clip}, 'states': {'moving' if prefix == 'run' else 'attacking': action},
    }
    dest = source / 'clips-input.json'
    if dest.exists():
        raise SystemExit(f'Refusing to replace {dest}')
    dest.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    subprocess.run([sys.executable, str(BUILDER), '--manifest', str(dest),
                    '--output-dir', str(ROOT / 'clips' / action), '--strict'], check=True)
