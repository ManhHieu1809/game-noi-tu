import * as T from '../vendor/three.module.min.js';
import {BASES,WALLS,PIN_SPAWNS,CLASSES,CORE_HP} from './data.js';
import {HumanHero as Hero} from './humanoid.js';
import {buildLandscape} from './landscape.js';
import {groundHeight,WORLD} from './terrain.js';
const TEAM=[0x69daca,0xffb568];
const mat=(color,roughness=.7,metalness=.1)=>new T.MeshStandardMaterial({color,roughness,metalness});
function mesh(g,m,parent,x=0,y=0,z=0){const a=new T.Mesh(g,m);a.position.set(x,y,z);a.castShadow=true;a.receiveShadow=true;parent.add(a);return a;}
const box=(w,h,d,m,p,x,y,z)=>mesh(new T.BoxGeometry(w,h,d),m,p,x,y,z);
const sphere=(r,m,p,x,y,z,sx=1,sy=1,sz=1)=>{const a=mesh(new T.SphereGeometry(r,12,10),m,p,x,y,z);a.scale.set(sx,sy,sz);return a;};
const cylinder=(r1,r2,h,m,p,x,y,z)=>mesh(new T.CylinderGeometry(r1,r2,h,12),m,p,x,y,z);
function ring(r,color,parent,y=.05){const a=new T.Mesh(new T.RingGeometry(r-.07,r,48),new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.75}));a.rotation.x=-Math.PI/2;a.position.y=y;parent.add(a);return a;}
function label(text,color='#d9fff0'){
  const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#102029d9';ctx.fillRect(0,0,256,64);ctx.fillStyle=color;ctx.font='bold 23px Segoe UI';ctx.textAlign='center';ctx.fillText(text,128,40);
  const texture=new T.CanvasTexture(c),a=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));a.scale.set(2.6,.65,1);return a;
}
export class ArenaScene {
  constructor(container){
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;container.append(this.renderer.domElement);
    this.scene=new T.Scene();this.scene.background=new T.Color(0x9bbbc1);this.scene.fog=new T.Fog(0x9bbbc1,65,210);
    this.camera=new T.PerspectiveCamera(43,1,.1,280);this.camera.position.set(25,33,37);this.camera.lookAt(0,0,0);
    this.scene.add(new T.HemisphereLight(0xd5edf2,0x465044,2.4));const sun=new T.DirectionalLight(0xffe2ad,3.2);sun.position.set(-12,30,12);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-28,right:28,top:22,bottom:-22,near:1,far:75});sun.shadow.bias=-.0006;sun.shadow.normalBias=.035;this.scene.add(sun);this.sun=sun;
    this.heroes=new Map();this.dynamic=new T.Group();this.dynamicObjects=new Map();this.scene.add(this.dynamic);this.lastEvent=0;this.fx=[];this.coreMeshes=[];this.shields=[];
    const land=buildLandscape(this.scene);this.terrain=land.terrain;this.coreMeshes=land.cores;this.shields=land.shields;this.water=land.water;
    this.cursor=new T.Group();ring(.5,0xf8eac2,this.cursor,.12);this.scene.add(this.cursor);this.scene.add(this.sun.target);
    this.destination=new T.Group();ring(.7,0xb1ffe7,this.destination,.12);this.destination.visible=false;this.scene.add(this.destination);
    this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.aim=new T.Vector3();
    this.resize();
  }
  aimAt(clientX,clientY){const r=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new T.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);const hit=this.ray.intersectObject(this.terrain)[0];if(hit)this.aim.copy(hit.point);else this.ray.ray.intersectPlane(this.plane,this.aim);return {ax:Math.max(-WORLD.halfX+1,Math.min(WORLD.halfX-1,this.aim.x)),az:Math.max(-WORLD.halfZ+1,Math.min(WORLD.halfZ-1,this.aim.z))};}
  clearDynamic(){for(const o of [...this.dynamic.children]){this.dynamic.remove(o);o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}}}
  render(state,localId,dt,previewRole='fighter'){
    if((state?.time??0)<(this.lastTime??0))this.lastEvent=0;this.lastTime=state?.time??0;
    const players=state?.players??[{id:'preview',name:CLASSES[previewRole].name,role:previewRole,team:0,x:-2,z:3,yaw:.3,hp:100,maxHp:100}];const seen=new Set(players.map(p=>p.id));
    for(const [id,h] of this.heroes)if(!seen.has(id)||players.find(p=>p.id===id)?.role!==h.role){this.scene.remove(h.group);this.disposeObject(h.group);this.heroes.delete(id);}
    for(const p of players){let h=this.heroes.get(p.id);if(!h){h=new Hero(p,this.scene);h.role=p.role;this.heroes.set(p.id,h);}h.update(p,dt,p.id===localId);}
    for(const e of state?.events??[])if(e.id>this.lastEvent){this.lastEvent=e.id;const h=[...this.heroes.values()].find(h=>Math.hypot(h.group.position.x-e.x,h.group.position.z-e.z)<1);if(h&&(e.type==='attack'||e.type==='skill'))h.pulse=1;
      if(['hit','blast','deposit','pickup','dash','skill'].includes(e.type)){const g=new T.Group();g.position.set(e.x,groundHeight(e.x,e.z)+.18,e.z);const skill=e.type==='skill';ring(e.type==='blast'?3:skill?1.2:.6,e.type==='hit'?0xffe7b0:TEAM[e.team],g,0);
        if(skill){const color=e.role==='mage'?0xc49bff:e.role==='fighter'?0xffdc85:TEAM[e.team];for(let j=0;j<10;j++){const a=j*Math.PI/5;const shard=mesh(new T.ConeGeometry(.12,.7,4),new T.MeshBasicMaterial({color,transparent:true,opacity:.9}),g,Math.cos(a)*1.4,.4,Math.sin(a)*1.4);shard.rotation.z=-a;}
          if(e.slot===1||e.role==='tank'){const dome=mesh(new T.SphereGeometry(1.4,16,10),new T.MeshBasicMaterial({color,wireframe:true,transparent:true,opacity:.3}),g,0,.9,0);dome.scale.y=1.3;}}
        this.scene.add(g);this.fx.push({group:g,life:skill?.9:.4,total:skill?.9:.4});}
    }
    for(const f of this.fx){f.life-=dt;f.group.scale.setScalar(1+(1-f.life/f.total)*1.8);for(const o of f.group.children)o.material.opacity=Math.max(0,f.life/f.total)*.75;}
    this.fx=this.fx.filter(f=>{if(f.life>0)return true;this.scene.remove(f.group);this.disposeObject(f.group);return false;});
    const local=players.find(p=>p.id===localId);const target=local?new T.Vector3(local.x,groundHeight(local.x,local.z),local.z):new T.Vector3(0,0,1);
    if(local){this.sun.position.set(local.x-12,30+target.y,local.z+12);this.sun.target.position.copy(target);}
    const zoom=this.zoom??24;const desired=local?target.clone().add(new T.Vector3(0,zoom,zoom*.875)):new T.Vector3(26,29,33);this.camera.position.lerp(desired,1-Math.exp(-5*dt));this.camera.lookAt(target);
    const t=performance.now()/1000;this.coreMeshes.forEach((c,i)=>{c.rotation.y=t*.4;c.position.y=2.1+Math.sin(t*1.6+i)*.1;this.shields[i].visible=!(state?.teams[i].exposed>0);});
    this.cursor.visible=!!local;this.cursor.position.set(this.aim.x,groundHeight(this.aim.x,this.aim.z)+.06,this.aim.z);
    const active=new Set();const object=(key,create)=>{active.add(key);if(!this.dynamicObjects.has(key))this.dynamicObjects.set(key,create());return this.dynamicObjects.get(key);};
    for(const pin of state?.pins??[])if(pin.active){const o=object('p'+pin.id,()=>mesh(new T.OctahedronGeometry(.28),new T.MeshStandardMaterial({color:0xf4db83,emissive:0xb87d28,emissiveIntensity:.5,metalness:.6,roughness:.25}),this.dynamic));o.position.set(pin.x,groundHeight(pin.x,pin.z)+.65+Math.sin(t*2+pin.id)*.12,pin.z);o.rotation.y=t;o.scale.setScalar(pin.value>1?1.3:1);o.scale.y*=1.4;}
    for(const s of state?.shots??[]){const o=object('s'+s.id,()=>sphere(.13,new T.MeshBasicMaterial({color:TEAM[s.team]}),this.dynamic,0,0,0,1,1,2.3));o.position.set(s.x,groundHeight(s.x,s.z)+1.15,s.z);o.rotation.y=Math.atan2(s.dx,s.dz);}
    for(const z of state?.zones??[]){const o=object('z'+z.id,()=>{const a=new T.Mesh(z.type==='barrier'?new T.SphereGeometry(z.r,20,10):new T.CircleGeometry(z.r,32),new T.MeshBasicMaterial({color:z.type==='storm'?0xf4a887:TEAM[z.team],transparent:true,opacity:.25,side:T.DoubleSide,depthWrite:false,wireframe:z.type==='barrier'}));if(z.type==='barrier')a.scale.y=.6;else a.rotation.x=-Math.PI/2;this.dynamic.add(a);return a;});o.position.set(z.x,groundHeight(z.x,z.z)+.15,z.z);o.material.opacity=z.type==='storm'&&z.age<.8?.08:.28;
      if(z.type==='storm'){const bolt=object('b'+z.id,()=>mesh(new T.CylinderGeometry(.06,.15,5,5),new T.MeshBasicMaterial({color:0xe9c7ff,transparent:true,opacity:.8}),this.dynamic));bolt.position.set(z.x+Math.sin(t*14)*z.r*.7,groundHeight(z.x,z.z)+2.5,z.z+Math.cos(t*19)*z.r*.7);bolt.visible=z.age>.8&&Math.sin(t*24)>0;}}
    for(const [key,o] of this.dynamicObjects)if(!active.has(key)){this.dynamic.remove(o);this.disposeObject(o);this.dynamicObjects.delete(key);}
    this.renderer.render(this.scene,this.camera);
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();}
  quality(low){this.renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,1.35));this.renderer.shadowMap.enabled=!low;this.resize();}
  disposeObject(o){o.traverse(n=>{n.geometry?.dispose();for(const m of n.material?(Array.isArray(n.material)?n.material:[n.material]):[]){m.map?.dispose();m.dispose();}});}
  dispose(){this.disposeObject(this.scene);this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();}
}
