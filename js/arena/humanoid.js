import * as T from '../vendor/three.module.min.js';
import {groundHeight} from './terrain.js';
const COLORS=[0x64cbb9,0xf4ac68];
const material=(color,metalness=.15)=>new T.MeshStandardMaterial({color,roughness:.62,metalness});
function part(parent,geometry,m,x=0,y=0,z=0){const a=new T.Mesh(geometry,m);a.position.set(x,y,z);a.castShadow=a.receiveShadow=true;parent.add(a);return a;}
const block=(p,m,w,h,d,x=0,y=0,z=0)=>part(p,new T.BoxGeometry(w,h,d),m,x,y,z);
const tube=(p,m,top,bottom,length,x=0,y=0,z=0)=>part(p,new T.CylinderGeometry(top,bottom,length,10),m,x,y,z);
function bone(parent,x,y,z){const b=new T.Group();b.position.set(x,y,z);parent.add(b);return b;}
function tapered(parent,m,points,x,y,z,squash=1){const g=new T.LatheGeometry(points.map(([r,h])=>new T.Vector2(r,h)),12);const o=part(parent,g,m,x,y,z);o.scale.z=squash;return o;}
function dispose(o){o.traverse(n=>{n.geometry?.dispose();if(n.material){n.material.map?.dispose();n.material.dispose();}});}
export class HumanHero {
  constructor(p,scene){
    this.group=new T.Group();scene.add(this.group);this.group.position.set(p.x,groundHeight(p.x,p.z),p.z);this.rig=bone(this.group,0,0,0);this.phase=0;this.pulse=0;this.velocity=0;
    this.skin=material(0xc79878),this.cloth=material(p.role==='mage'?0x494270:0x283b46),this.armor=material(COLORS[p.team],.55),this.leather=material(0x4e3730),this.steel=material(0xc0c5bc,.7);
    this.glow=new T.MeshStandardMaterial({color:COLORS[p.team],emissive:COLORS[p.team],emissiveIntensity:.8,roughness:.3});
    const scale=p.role==='tank'?1.13:p.role==='mage'?.98:1;this.rig.scale.set(scale,scale,scale);
    this.hips=bone(this.rig,0,1.08,0);tapered(this.hips,this.cloth,[[.24,0],[.33,.18],[.29,.35]],0,-.2,0,.72);
    this.chest=bone(this.hips,0,.12,0);tapered(this.chest,this.cloth,[[.26,0],[.32,.25],[.43,.58],[.36,.68]],0,0,0,.65);
    // Breastplate follows the torso, rather than a spherical body.
    tapered(this.chest,this.armor,[[.29,.15],[.36,.38],[.44,.57],[.32,.62]],0,0,.025,.64);
    block(this.chest,this.leather,.63,.09,.43,0,.07,0);block(this.chest,this.steel,.13,.11,.04,0,.07,.24);
    this.head=bone(this.chest,0,.81,0);tube(this.head,this.skin,.105,.12,.2,0,-.07,0);
    tapered(this.head,this.skin,[[.11,0],[.22,.09],[.245,.29],[.22,.46],[.12,.52]],0,0,0,.8);
    const hair=material(p.role==='mage'?0xd2cfc1:0x322b2b);tapered(this.head,hair,[[.245,.31],[.25,.45],[.15,.55],[0,.57]],0,0,-.015,.84);
    block(this.head,this.skin,.075,.11,.1,0,.23,.205);for(const side of [-1,1]){
      block(this.head,material(0xe7e5d6),.075,.045,.03,side*.1,.28,.187);block(this.head,material(0x243b3e),.027,.035,.025,side*.1,.28,.207);
      block(this.head,hair,.1,.025,.035,side*.1,.34,.18);tube(this.head,this.skin,.055,.055,.11,side*.25,.23,0);
    }block(this.head,this.leather,.1,.015,.025,0,.125,.17);
    this.arms=[];this.elbows=[];this.hands=[];this.legs=[];this.knees=[];this.feet=[];
    for(const side of [-1,1]){
      const shoulder=bone(this.chest,side*.43,.56,0);this.arms.push(shoulder);
      tube(shoulder,this.cloth,.14,.105,.41,side*.025,-.19,0);tube(shoulder,this.armor,.19,.15,.16,side*.025,-.04,0);
      const elbow=bone(shoulder,side*.025,-.4,0);this.elbows.push(elbow);tube(elbow,this.skin,.105,.085,.37,0,-.17,0);tube(elbow,this.leather,.095,.1,.11,0,-.31,0);
      const hand=bone(elbow,0,-.4,0);this.hands.push(hand);block(hand,this.skin,.13,.16,.085,0,-.03,.025);block(hand,this.skin,.035,.095,.06,side*-.075,.015,.04);
      const hip=bone(this.hips,side*.185,-.08,0);this.legs.push(hip);tube(hip,this.cloth,.16,.12,.49,0,-.23,0);
      const knee=bone(hip,0,-.48,0);this.knees.push(knee);tube(knee,this.leather,.115,.085,.43,0,-.2,0);block(knee,this.armor,.19,.16,.12,0,-.04,.08);
      const foot=bone(knee,0,-.44,0);this.feet.push(foot);block(foot,this.leather,.23,.15,.4,0,-.015,.085);block(foot,this.steel,.23,.06,.17,0,.035,.2);
    }
    this.weapon=bone(this.hands[1],0,-.01,.1);const m=this.steel;
    if(p.role==='fighter'){tube(this.weapon,this.leather,.035,.035,.27);block(this.weapon,m,.4,.06,.1,0,.15);const blade=block(this.weapon,m,.115,.9,.055,0,.62);block(this.weapon,this.glow,.025,.78,.065,.07,.62);blade.rotation.z=-.05;}
    else if(p.role==='tank'){tube(this.weapon,this.leather,.05,.05,1,0,.27);block(this.weapon,this.armor,.65,.36,.32,0,.8);this.shield=block(this.hands[0],this.armor,.42,.64,.12,0,.15,.14);}
    else if(p.role==='mage'){tube(this.weapon,this.leather,.04,.055,1.5,0,.48);part(this.weapon,new T.OctahedronGeometry(.18),this.glow,0,1.35,0);block(this.chest,this.cloth,.55,.7,.08,0,-.1,-.23);}
    else{block(this.weapon,this.leather,.16,.18,.65,0,.02,.3);tube(this.weapon,m,.045,.045,.65,0,.02,.6).rotation.x=Math.PI/2;block(this.weapon,this.glow,.1,.08,.22,0,.19,.3);}
    this.itemNodes=[];this.itemKey='';
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle='#102029d9';c.fillRect(0,0,256,64);c.fillStyle='#d7efdf';c.textAlign='center';c.font='22px Segoe UI';c.fillText(p.name,128,40);
    this.name=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(canvas),depthTest:false}));this.name.scale.set(2.2,.55,1);this.name.position.y=3.1;this.group.add(this.name);
    this.health=block(this.group,material(0x83e8a6),1,.06,.045,0,2.8,0);
    this.selection=part(this.group,new T.RingGeometry(.65,.72,24),new T.MeshBasicMaterial({color:COLORS[p.team],transparent:true,opacity:.6,side:T.DoubleSide}),0,.03,0);this.selection.rotation.x=-Math.PI/2;
    this.aura=part(this.rig,new T.SphereGeometry(.85,16,10),new T.MeshBasicMaterial({color:0x83d9ff,transparent:true,opacity:.16,wireframe:true}),0,1.2,0);this.aura.scale.y=1.5;this.aura.visible=false;
  }
  equip(items){
    const key=items.join('|');if(key===this.itemKey)return;this.itemKey=key;
    for(const n of this.itemNodes){n.parent.remove(n);dispose(n);}this.itemNodes=[];
    items.forEach((id,index)=>{
      const m=material([0xc6b379,0x7ca5bd,0xab89c1][index],.65),l=material(0x302f39);let parent=this.chest,x=0,y=.3,z=.28;
      if(['blade','hammer','staff'].includes(id)){parent=this.weapon;x=.17*(index+1);y=.5;z=0;}
      if(['claw','medic'].includes(id)){parent=this.elbows[0];x=0;y=-.22;z=.05;}
      if(id==='boots'){parent=this.feet[0];x=0;y=.12;z=0;}
      if(id==='scope'){parent=this.head;x=.18;y=.32;z=.23;}
      if(['pack','relay','motor','coil'].includes(id)){x=.22*(index-1);y=.35;z=-.32;}
      if(['heart','prism'].includes(id)){x=.15*(index-1);y=.52;z=.3;}
      if(id==='battery'){y=.06;z=.28;}
      if(id==='shell'){x=-.44;y=.59;z=0;}
      const g=bone(parent,x,y,z);this.itemNodes.push(g);
      if(id==='boots'){block(g,m,.27,.19,.42);const other=bone(this.feet[1],0,.12,0);block(other,material(0xc6b379,.65),.27,.19,.42);this.itemNodes.push(other);}
      else if(['prism','heart','reactor'].includes(id)){part(g,new T.OctahedronGeometry(.16),m);tube(g,l,.19,.19,.06).rotation.x=Math.PI/2;}
      else if(['blade','staff','hammer'].includes(id)){tube(g,l,.035,.035,.6);if(id==='staff')part(g,new T.OctahedronGeometry(.15),m,0,.4,0);else block(g,m,id==='hammer'?.35:.08,.4,.1,0,.3);}
      else if(['plate','insulator','shell'].includes(id)){block(g,m,id==='shell'?.32:.68,.46,.14);for(const side of [-1,1])block(g,l,.055,.4,.04,side*.24,0,.09);}
      else if(id==='scope'){tube(g,m,.08,.08,.22).rotation.x=Math.PI/2;}
      else{block(g,m,id==='pack'?.5:.24,id==='pack'?.55:.25,.22);tube(g,l,.065,.065,.28,.12,0,.14);}
    });
  }
  update(p,dt,local){
    this.equip(p.items??[]);const target=new T.Vector3(p.x,groundHeight(p.x,p.z)+.02,p.z);
    const distance=Math.hypot(this.group.position.x-p.x,this.group.position.z-p.z);const moving=Math.min(1,distance/(dt*5||1));this.velocity+=(moving-this.velocity)*Math.min(1,dt*12);
    this.group.position.lerp(target,local?1:1-Math.exp(-16*dt));this.group.visible=!p.respawn;this.phase+=dt*9*(this.velocity>.05?1:0);
    const diff=Math.atan2(Math.sin(p.yaw-this.rig.rotation.y),Math.cos(p.yaw-this.rig.rotation.y));this.rig.rotation.y+=diff*(1-Math.exp(-15*dt));
    this.rig.position.y=Math.abs(Math.sin(this.phase))*this.velocity*.045;this.chest.rotation.y=Math.sin(this.phase)*this.velocity*.07;
    this.pulse=Math.max(0,this.pulse-dt*3.5);
    this.legs.forEach((leg,i)=>{const stride=Math.sin(this.phase+i*Math.PI)*this.velocity;leg.rotation.x=stride*.55;this.knees[i].rotation.x=Math.max(0,-stride)*.95;this.feet[i].rotation.x=-this.knees[i].rotation.x*.3;});
    this.arms.forEach((arm,i)=>{arm.rotation.x=-Math.sin(this.phase+i*Math.PI)*this.velocity*.35-(i===1?this.pulse*1.3:0);arm.rotation.z=i?-.08:.08;this.elbows[i].rotation.x=-.22-this.velocity*.25-this.pulse*.4;});
    this.aura.visible=(p.guard??0)>0||(p.shield??0)>0||(p.rapid??0)>0;this.aura.material.color.setHex(p.rapid>0?0xffbb5c:p.guard>0?0xffdf8b:0x83d9ff);this.aura.rotation.y+=dt;
    this.health.scale.x=Math.max(.001,p.hp/p.maxHp);this.selection.material.opacity=local?.8:.22;
  }
}
// A small independent preview is only alive while the shop is open.
export class CharacterPreview {
  constructor(container){
    this.renderer=new T.WebGLRenderer({antialias:true});this.renderer.setSize(180,220);this.renderer.setPixelRatio(1);container.append(this.renderer.domElement);
    this.scene=new T.Scene();this.scene.background=new T.Color(0x10232d);this.scene.add(new T.HemisphereLight(0xe2f3ef,0x48566a,3));const sun=new T.DirectionalLight(0xffe5bb,3);sun.position.set(3,5,4);this.scene.add(sun);
    this.camera=new T.PerspectiveCamera(38,180/220,.1,20);this.camera.position.set(2.7,2.2,4.2);this.camera.lookAt(0,1.35,0);
  }
  render(p,dt){
    if(this.role!==p.role){if(this.hero){this.scene.remove(this.hero.group);dispose(this.hero.group);}this.hero=new HumanHero({...p,x:0,z:0},this.scene);this.role=p.role;}
    this.hero.update({...p,x:0,z:0,yaw:.2,respawn:0},dt,true);this.hero.group.position.y=0;this.hero.name.visible=false;this.hero.health.visible=false;this.hero.selection.visible=false;this.renderer.render(this.scene,this.camera);
  }
  dispose(){if(this.hero)dispose(this.hero.group);this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
