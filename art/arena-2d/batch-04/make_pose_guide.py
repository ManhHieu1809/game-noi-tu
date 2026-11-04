"""GEOMETRY REFERENCE ONLY. Generates no deliverable character/sprite art.

Projected constant-length skeletons communicate gait phases to ImageGen.
The generated game artwork must come from ImageGen using the accepted master.
"""
from pathlib import Path
import json
import math
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'references'
OUT.mkdir(parents=True,exist_ok=True)
CELL=512
SCALE=200
ANGLE=math.radians(35)
NEAR='#f17425'
FAR='#237acf'
FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)

def project(f,h,l):
    return (256+SCALE*.70710678*(f+l),
            400+SCALE*(.70710678*math.sin(ANGLE)*(f-l)-math.cos(ANGLE)*h))

def knee(hip,ankle):
    f0,h0=hip;f1,h1=ankle
    df,dh=f1-f0,h1-h0
    d=math.hypot(df,dh)
    assert d<1.04,(hip,ankle,d)
    offset=math.sqrt(.52**2-(d/2)**2)
    return ((f0+f1)/2-dh/d*offset,(h0+h1)/2+df/d*offset)

phases=[
 ('1 NEAR contact',.94,(.40,.06),(-.42,.17),-.24),
 ('2 NEAR down',.90,(.10,.06),(-.42,.40),-.10),
 ('3 NEAR passing',.98,(-.20,.07),(.02,.39),.08),
 ('4 flight to FAR',1.00,(-.40,.22),(.30,.22),.22),
 ('5 FAR contact',.94,(-.42,.17),(.40,.06),.24),
 ('6 FAR down',.90,(-.42,.40),(.10,.06),.10),
 ('7 FAR passing',.98,(.02,.39),(-.20,.07),-.08),
 ('8 flight to NEAR',1.00,(.30,.22),(-.40,.22),-.22),
]
sheet=Image.new('RGB',(2048,1024),'#f5f7fa')
records=[]
for index,(name,hip_h,near_ankle,far_ankle,arm_f) in enumerate(phases):
    cell=Image.new('RGB',(CELL,CELL),'#f5f7fa');draw=ImageDraw.Draw(cell)
    draw.rectangle((76,76,436,452),outline='#cad2dc',width=1)
    draw.line((245,400,267,400),fill='#9ba7b2',width=1)
    draw.line((256,389,256,411),fill='#9ba7b2',width=1)
    bob=hip_h-.94
    head=project(.16,1.65+bob,0)
    draw.ellipse((head[0]-28,head[1]-34,head[0]+28,head[1]+34),outline='#455368',width=3)
    neck=project(.13,1.43+bob,0)
    waist=project(0,hip_h,0)
    draw.line((*neck,*waist),fill='#667488',width=5)
    points={}
    for side,lateral,ankle,color,hand_f in [('FAR',.105,far_ankle,FAR,-arm_f),('NEAR',-.105,near_ankle,NEAR,arm_f)]:
        hip=project(0,hip_h,lateral)
        k=knee((0,hip_h),ankle)
        kneep=project(k[0],k[1],lateral)
        foot=project(ankle[0],ankle[1],lateral)
        toe=project(ankle[0]+.13,max(.03,ankle[1]-.015),lateral)
        shoulder=project(.10,1.4+bob,lateral*1.5)
        elbow=project((hand_f+.10)/2-.08,1.19+bob,lateral*1.8)
        wrist=project(hand_f,1.10+bob,lateral*1.9)
        draw.line([shoulder,elbow,wrist],fill=color,width=8)
        draw.line([hip,kneep,foot,toe],fill=color,width=8)
        for p in [shoulder,elbow,wrist,hip,kneep,foot]:
            draw.ellipse((p[0]-5,p[1]-5,p[0]+5,p[1]+5),fill='white',outline=color,width=2)
        points[side]={'hip':hip,'knee':kneep,'ankle':foot,'toe':toe,'shoulder':shoulder,'elbow':elbow,'wrist':wrist}
    draw.text((20,20),name,font=FONT,fill='#26374b')
    draw.text((20,476),'ORANGE = NEAR / RIGHT    BLUE = FAR / LEFT',font=FONT,fill='#46566c')
    sheet.paste(cell,((index%4)*CELL,(index//4)*CELL))
    records.append({'frame':index,'phase':name,'head_center':head,'head_radii':[28,34],'root':[256,400],'joints':points})
sheet.save(OUT/'run-se-pose-guide.png')
(OUT/'run-se-pose-guide.json').write_text(json.dumps({'purpose':'geometry reference only, NOT game art',
    'camera':'orthographic elevated 35 degrees, southeast','rows':2,'cols':4,'frames':records},indent=2),encoding='utf-8')
print(OUT/'run-se-pose-guide.png')

# Separate action-family reference: registered grounded slash. No run poses mixed in.
attacks=[
 ('1 ready',.94,(-.06,1.18),(.02,1.00),(.36,.38)),
 ('2 anticipation',.92,(-.25,1.34),(-.12,1.62),(.08,1.98)),
 ('3 wind peak',.90,(-.29,1.40),(-.23,1.65),(.25,1.96)),
 ('4 strike',.90,(.20,1.21),(.38,1.03),(.75,.50)),
 ('5 follow through',.93,(.13,1.02),(.25,.80),(.50,.25)),
 ('6 recovery',.94,(-.03,1.20),(.07,1.04),(.40,.40)),
]
attack_sheet=Image.new('RGB',(1536,1024),'#f5f7fa')
attack_records=[]
for index,(name,hip_h,elbow_pos,wrist_pos,tip_pos) in enumerate(attacks):
    cell=Image.new('RGB',(512,512),'#f5f7fa');draw=ImageDraw.Draw(cell)
    draw.rectangle((76,76,436,452),outline='#cad2dc',width=1)
    bob=hip_h-.94
    head=project(.12,1.65+bob,0)
    draw.ellipse((head[0]-28,head[1]-34,head[0]+28,head[1]+34),outline='#455368',width=3)
    draw.line([project(.1,1.43+bob,0),project(0,hip_h,0)],fill='#667488',width=5)
    joints={}
    for side,lateral,ankle,color in [('FAR',.105,(-.20,.06),FAR),('NEAR',-.105,(.20,.06),NEAR)]:
        hip=project(0,hip_h,lateral)
        k=knee((0,hip_h),ankle)
        kneep=project(k[0],k[1],lateral)
        foot=project(*ankle,lateral)
        toe=project(ankle[0]+.13,.045,lateral)
        shoulder=project(.1,1.40+bob,lateral*1.5)
        elbow=project(elbow_pos[0],elbow_pos[1],lateral*1.6) if side=='NEAR' else project(.18,1.21+bob,lateral*1.6)
        wrist=project(wrist_pos[0],wrist_pos[1],lateral*1.9) if side=='NEAR' else project(.32,1.18+bob,lateral*1.9)
        draw.line([hip,kneep,foot,toe],fill=color,width=8)
        draw.line([shoulder,elbow,wrist],fill=color,width=8)
        for p in [hip,kneep,foot,shoulder,elbow,wrist]:
            draw.ellipse((p[0]-5,p[1]-5,p[0]+5,p[1]+5),fill='white',outline=color,width=2)
        if side=='NEAR':
            tip=project(tip_pos[0],tip_pos[1],lateral*1.9)
            draw.line([wrist,tip],fill='#8c6b18',width=4)
        joints[side]={'hip':hip,'knee':kneep,'ankle':foot,'toe':toe,'shoulder':shoulder,'elbow':elbow,'wrist':wrist}
    draw.text((20,20),name,font=FONT,fill='#26374b')
    draw.text((20,476),'GEOMETRY ONLY / constant skull + pelvis origin',font=FONT,fill='#46566c')
    attack_sheet.paste(cell,((index%3)*512,(index//3)*512))
    attack_records.append({'frame':index,'phase':name,'head_center':head,'head_radii':[28,34],
                           'root':[256,400],'joints':joints})
attack_sheet.save(OUT/'attack-se-pose-guide.png')
(OUT/'attack-se-pose-guide.json').write_text(json.dumps({'purpose':'geometry reference only, NOT game art',
    'camera':'orthographic elevated 35 degrees, southeast','rows':2,'cols':3,'frames':attack_records},indent=2),encoding='utf-8')
