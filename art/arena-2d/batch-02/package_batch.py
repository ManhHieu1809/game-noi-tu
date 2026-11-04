"""Deterministic packaging/QA only. All visible artwork is ImageGen output.
Does not edit game runtime or generate new painted art.
"""
from pathlib import Path
import json, subprocess, sys, hashlib, html
from PIL import Image, ImageDraw, ImageSequence

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[2]
FORGE = PROJECT / 'tools/agent-sprite-forge/skills'
def read(p): return json.loads(Path(p).read_text(encoding='utf-8'))
def write(p, value):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def relative(p): return Path(p).relative_to(ROOT).as_posix()
def run(script,*args):
    r=subprocess.run([sys.executable,str(FORGE/script),*map(str,args)],cwd=PROJECT,capture_output=True,text=True,encoding='utf-8')
    if r.returncode: raise RuntimeError(r.stdout+r.stderr)
    return r.stdout.strip()

LOOPS={'orb','frost','water','arrow','crystal','tree-sway','waterfall'}
NAMES={'slash':'Vệt chém','shield':'Khiên năng lượng','earth':'Địa chấn','orb':'Cầu phép',
 'dash':'Lướt / bụi','frost':'Vùng làm chậm','water':'Nước chảy','arrow':'Đạn xuyên',
 'crystal':'Tinh thể xoay','tree-sway':'Cây lay động','waterfall':'Thác chảy','lightning':'Sét đánh'}
ROOT.joinpath('final/qa').mkdir(parents=True,exist_ok=True)
entries=[];warnings=[];history=[]
for folder in sorted((ROOT/'final/animations').iterdir()):
    if not folder.is_dir(): continue
    meta=read(folder/'pipeline-meta.json');name=folder.name
    frames=[folder/f'sheet-{i}.png' for i in range(1,7)]
    for p in frames:
        with Image.open(p) as im:
            assert im.size==(256,256) and im.mode=='RGBA',p
            lo,hi=im.getchannel('A').getextrema();assert lo==0 and hi>0,p
    with Image.open(folder/'animation.gif') as gif:
        decoded=sum(1 for _ in ImageSequence.Iterator(gif));assert decoded>=2,name
    cadence=18 if name=='tree-sway' else 12 if name=='crystal' else 9 if name=='frost' else 6
    manifest={'schema':'generate2dsprite.animation_clips.v2','frames':[p.name for p in frames],
      'anchor_px':[128,128],'art_source':'host_image','sampling':'linear','pixel_art':False,
      'clips':{name:{'frames':list(range(6)),'ticks':cadence,'loop_policy':'cycle' if name in LOOPS else 'oneshot','role':'prop' if name=='tree-sway' else 'fx'}},
      'states':{'active':name}}
    if name=='shield':
        manifest['clips']['shield-hold']={'frames':[4,5],'ticks':12,'loop_policy':'cycle','role':'fx'}
    write(folder/'clips-input.json',manifest)
    output=ROOT/'final/clips-v2'/name
    if not output.exists(): run(Path('generate2dsprite/scripts/build_animation_clips.py'),'--manifest',folder/'clips-input.json','--output-dir',output)
    clip=read(output/'animation-clips.json')
    checks=[c for c in meta.get('qa',{}).get('checks',[]) if c.get('status') in ('warn','fail')]
    checks += [c for c in clip.get('qa',{}).get('checks',[]) if c.get('status') in ('warn','fail')]
    warnings.extend({'asset':name,**c} for c in checks)
    entries.append({'id':name,'kind':'animation','title':NAMES.get(name,name),
      'image':relative(sorted(output.glob('clips/*.webp'))[0]),'gif':relative(folder/'animation.gif'),'sheet':relative(folder/'sheet-transparent.png'),
      'frames':6,'decoded_gif_frames':decoded,'duration_ms':cadence*100,'loop':name in LOOPS,
      'metadata':relative(output/'animation-clips.json'),'pipeline':relative(folder/'pipeline-meta.json'),
      'status':'processed-needs-runtime-review','key_qa':meta.get('matte',{}).get('qa_after_despill',meta.get('matte',{}).get('qa',{}))})

for meta_path in sorted(ROOT.glob('animations/*/pipeline-meta.json')):
    m=read(meta_path)
    for check in m.get('qa',{}).get('checks',[]):
        if check.get('status') in ('warn','fail'):history.append({'file':relative(meta_path),**check})

for name in ['tree','pine','bridge','core','stall']:
    p=ROOT/'props'/name/'clean.png';meta=read(p.parent/'pipeline-meta.json')
    with Image.open(p) as im: assert im.mode=='RGBA' and im.getchannel('A').getextrema()[0]==0
    entries.append({'id':name,'kind':'prop','title':name,'image':relative(p),'anchor_px':meta['frames'][0]['output_anchor'],'status':'processed-needs-placement-review'})
pack=read(ROOT/'props/compact/prop-pack.json')
for check in pack.get('qa',{}).get('checks',[]):
    if check.get('status') in ('warn','fail'):warnings.append({'asset':'compact-props',**check})
for name in ['moss-rock','shrub','flowers','stone-stump']:
    entries.append({'id':name,'kind':'prop','title':name,'image':f'props/compact/{name}/prop.png','status':'processed-needs-placement-review'})
for name in ['mage','tank','ranger']:
    p=ROOT/'characters'/name/'master_rgba.png'
    entries.append({'id':name,'kind':'character-master','title':name+' / SE master','image':relative(p),'status':'master-only-not-animated'})
entries.append({'id':'mountain','kind':'terrain-sample','title':'Đồi núi / đường dốc','image':'raw/mountain.png','status':'art-only-no-collision'})

# Metadata and one composed scene made of separate generated assets.
props=[]
def place(name,x,y,scale):
    p=ROOT/'props'/name/'clean.png';m=read(p.parent/'pipeline-meta.json')
    anchor=m['frames'][0]['output_anchor']
    if name=='bridge':anchor=[384,730] # midpoint between the two footings, not the automatically detected left foot
    props.append({'id':f'{name}-{len(props)}','image':relative(p),'x':x,'y':y,'scale':scale,
      'anchor':'px','anchorPx':anchor,'sortY':y,'layer':'props',
      'occlusion_class':'tall','occupant_policy':'y_sort'})
for args in [('tree',150,380,.28),('tree',1100,220,.28),('tree',1180,350,.25),
 ('pine',1300,230,.25),('pine',850,775,.24),('tree',180,810,.3),
 ('core',290,445,.27),('stall',1140,490,.32),('bridge',690,620,.44)]:place(*args)
master=read(ROOT.parent/'characters/fighter-anime/master/master.json')
actors=[{'id':'fighter-demo','image':'../characters/fighter-anime/master/master_rgba.png',
 'x':440,'y':550,'scale':.14,'anchor':'px','anchorPx':master['framing']['anchor'],'sortY':550,'layer':'actors'}]
placements={'schema':'generate2dmap.placements.v2','props':props,'actors':actors,'foreground':[]}
write(ROOT/'placements.json',placements)
preview=ROOT/'final/layered-preview-v2.png'
if not preview.exists():run(Path('generate2dmap/scripts/compose_layered_preview.py'),'--base',ROOT.parent/'map/foundation-anime.png','--placements',ROOT/'placements.json','--output',preview,'--resampler','lanczos','--report',ROOT/'final/qa/compose-report-v2.json')

# Contact sheet: composite only, no new creative drawing.
sources=[ROOT.parent/'characters/fighter-anime/master/master_rgba.png']+[ROOT/'characters'/n/'master_rgba.png' for n in ['tank','mage','ranger']]
lineup=Image.new('RGBA',(1000,370),'#172936');draw=ImageDraw.Draw(lineup)
for i,p in enumerate(sources):
    im=Image.open(p).convert('RGBA');im=im.crop(im.getchannel('A').getbbox());ratio=290/im.height;im=im.resize((round(im.width*ratio),290),Image.Resampling.LANCZOS)
    lineup.alpha_composite(im,(i*250+(250-im.width)//2,25));draw.text((i*250+80,335),['FIGHTER','TANK','MAGE','RANGER'][i],fill='white')
lineup.save(ROOT/'final/character-lineup.png')

write(ROOT/'final/qa/warnings.json',{'selected_outputs':warnings,'superseded_attempts':history,
 'not_proven':['runtime playback','perfect loop seams','root locking of foliage','multiplayer alignment','complete eight-direction character animation']})
files=[]
for p in sorted(ROOT.rglob('*.png')):
    with Image.open(p) as im:size=list(im.size)
    files.append({'path':relative(p),'size':size,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
write(ROOT/'final/catalog.json',{'schema':'arena.asset-catalog.v1','art_source':'host_image',
 'forge_commit':'5324342fdfab72430f4e9604f3fe427009f8596d','integrated':False,'entries':entries,'files':files,
 'animation_count':sum(e['kind']=='animation' for e in entries),'frame_count':sum(e.get('frames',0) for e in entries),
 'selected_warning_count':len(warnings),'character_animation':'blocked-no-video-route; motion jobs prepared only'})
cards=[]
for e in entries:
    cards.append(f'<article><a href="{html.escape(e["image"])}"><img loading="lazy" src="{html.escape(e["image"])}" alt="{html.escape(e["title"])}"></a><h3>{html.escape(e["title"])}</h3><small>{html.escape(e["status"])}</small></article>')
page='''<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Anime Asset Library / Batch 02</title><style>body{background:#101d29;color:#e8f3ed;font:15px system-ui;margin:30px}h1{color:#9de8d2}p{max-width:950px;line-height:1.8}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}article{background:#1b3040;border:1px solid #3a5360;border-radius:12px;padding:12px}article img{width:100%;height:240px;object-fit:contain;background:repeating-conic-gradient(#304553 0% 25%,#263b49 0% 50%) 50%/20px 20px}small{color:#a8c3c6}a{color:#97e6cf}.wide{width:min(100%,1200px);border-radius:12px}</style><h1>Thư viện asset anime — đợt 02</h1><p>Ảnh nguồn từ ImageGen, tách nền và animation bằng Agent Sprite Forge. Chưa tích hợp game. GIF là preview lặp để dễ xem; metadata phân biệt chiêu one-shot và loop. Nhân vật hiện chỉ có master SE; animation chạy/đánh tám hướng chưa được tạo vì thiếu route video.</p><p><a href="final/catalog.json">Catalog</a> · <a href="final/qa/warnings.json">QA và cảnh báo</a> · <a href="../REBUILD-PLAN.md">Kế hoạch</a></p><h2>Ráp từ nền và props tách riêng</h2><img class="wide" src="final/layered-preview.png"><h2>Bốn nhân vật</h2><img class="wide" src="final/character-lineup.png"><h2>Asset / animation xem thử</h2><section>'''+''.join(cards)+'</section></html>'
(ROOT/'gallery.html').write_text(page.replace('final/layered-preview.png','final/layered-preview-v2.png').replace('GIF là preview lặp để dễ xem','WebP/GIF là preview để dễ xem'),encoding='utf-8')
print(json.dumps({'assets':len(entries),'animations':sum(e['kind']=='animation' for e in entries),'frames':sum(e.get('frames',0) for e in entries),'warnings':len(warnings)},ensure_ascii=False))
