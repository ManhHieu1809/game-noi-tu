"""Run unmodified Forge diagnostics; retain all failing/warning reports."""
from pathlib import Path
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parent
FORGE=ROOT.parents[2]/'tools/agent-sprite-forge/skills/generate2dsprite/scripts'
for action,prefix,count,cols,source in [
    ('run-se','run',8,4,'run-se-registered-v2.png'),
    ('attack-se','attack',6,3,'attack-se-registered.png'),
]:
    jobs=[
        (f'{action}-spill',['spill','--input',str(ROOT/'raw'/source),'--rows','2','--cols',str(cols)]),
        (f'{action}-frames',['frames','--frames',*[str(ROOT/'processed'/action/f'{prefix}-{i+1}.png')for i in range(count)],
                            '--cycle','run'if prefix=='run'else'none','--game-pixel','2','--frames-per-row',str(cols)]),
    ]
    if prefix=='run':jobs[-1][1].extend(['--facing','right','--torso-colors','#235e76,#317b92'])
    else:jobs[-1][1].extend(['--no-loop'])
    for name,args in jobs:
        dest=ROOT/'qa'/name
        if not dest.exists():
            result=subprocess.run([sys.executable,str(FORGE/'sheet_qc.py'),*args,'--output-dir',str(dest)],check=False)
            if result.returncode not in(0,1):raise RuntimeError('Diagnostic execution failed')
        report=json.loads((dest/'sheet-qc.json').read_text(encoding='utf-8'))
        print(json.dumps({'name':name,'status':report['status'],
                          'issues':[c for c in report['checks']if c['status']in('warn','fail')]},ensure_ascii=False))
