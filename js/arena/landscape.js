import * as T from '../vendor/three.module.min.js';
import {WORLD,terrainHeight,groundHeight,riverZ} from './terrain.js';
import {BASES,WALLS,PIN_SPAWNS} from './data.js';
export function buildLandscape(scene){
  const mat=(c,metalness=0)=>new T.MeshStandardMaterial({color:c,roughness:.85,metalness});
  const mesh=(g,m,x,y,z)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;scene.add(o);return o;};
  const box=(w,h,d,m,x,y,z)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z);
  const earth=new T.PlaneGeometry(WORLD.halfX*2,WORLD.halfZ*2,160,120);earth.rotateX(-Math.PI/2);
  const pos=earth.attributes.position,colors=[];const c=new T.Color();
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),h=terrainHeight(x,z);pos.setY(i,h);const noise=(Math.sin(x*1.7+z*2.3)+1)*.025;
    c.set(h>7?0x858e78:h<.35?0xa69b75:0x718e56);c.offsetHSL(0,noise,noise);colors.push(c.r,c.g,c.b);}
  earth.setAttribute('color',new T.Float32BufferAttribute(colors,3));earth.computeVertexNormals();
  const terrain=mesh(earth,new T.MeshStandardMaterial({vertexColors:true,roughness:1}),0,0,0);terrain.castShadow=false;
  const wp=[],wi=[];for(let i=0;i<=160;i++){const x=-80+i;for(const side of [-1,1])wp.push(x,-.23,riverZ(x)+side*3.3);if(i<160){const j=i*2;wi.push(j,j+1,j+2,j+1,j+3,j+2);}}
  const waterGeo=new T.BufferGeometry();waterGeo.setAttribute('position',new T.Float32BufferAttribute(wp,3));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();const water=mesh(waterGeo,new T.MeshStandardMaterial({color:0x4d9ca5,metalness:.35,roughness:.22,transparent:true,opacity:.83,side:T.DoubleSide}),0,0,0);water.castShadow=false;
  const stone=mat(0x7b8177),metal=mat(0x425964,.4),gold=mat(0xd0af70,.35),wood=mat(0x806349);
  for(const x of [-25,25]){const z=riverZ(x);for(let i=0;i<28;i++)box(4.4,.22,.48,wood,x,.54,z-6.8+i*.5);for(const side of [-1,1]){box(.12,.12,14,wood,x+side*2.1,1.3,z);for(let i=-6;i<=6;i+=3)box(.17,1.4,.17,wood,x+side*2.1,.9,z+i);}}
  for(const w of WALLS){const h=groundHeight(w.x,w.z);box(w.w,1.55,w.d,metal,w.x,h+.78,w.z);box(w.w+.15,.15,w.d+.15,stone,w.x,h+1.65,w.z);}
  const cores=[],shields=[];
  BASES.forEach((b,i)=>{const color=[0x69daca,0xffb568][i],h=groundHeight(b.x,b.z),g=new T.Group();g.position.set(b.x,h,b.z);scene.add(g);
    const part=(geo,m,x,y,z)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
    part(new T.CylinderGeometry(3,3.4,.3,32),metal,0,.15,0);const glow=new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1,roughness:.3,metalness:.5});
    const r=part(new T.RingGeometry(2.9,3.05,48),new T.MeshBasicMaterial({color,side:T.DoubleSide}),0,.32,0);r.rotation.x=-Math.PI/2;
    const core=part(new T.OctahedronGeometry(.9),glow,0,2,0);core.scale.y=1.5;cores.push(core);
    for(let j=0;j<4;j++){const a=j*Math.PI/2;part(new T.BoxGeometry(.22,2.8,.22),metal,Math.cos(a)*1.2,1.4,Math.sin(a)*1.2);}
    const shield=part(new T.SphereGeometry(1.9,24,16),new T.MeshBasicMaterial({color,transparent:true,opacity:.12,wireframe:true}),0,1.7,0);shields.push(shield);
    box(2,1,1,metal,b.x,h+.5,5);box(1.5,.7,.1,glow,b.x,h+1.3,5);
    for(let k=-3;k<=3;k++){box(2.5,.12,1,stone,b.x+k*2.5,h-.02,-5);}
  });
  for(const p of PIN_SPAWNS)mesh(new T.CylinderGeometry(.8,1,.22,16),metal,p.x,groundHeight(p.x,p.z)+.12,p.z);
  // Instanced forest: large world without hundreds of individual tree draw calls.
  const count=130,trunks=new T.InstancedMesh(new T.CylinderGeometry(.12,.25,2.8,6),wood,count),leaves=new T.InstancedMesh(new T.ConeGeometry(1.6,4.8,7),mat(0x3e6954),count),dummy=new T.Object3D();
  for(let i=0;i<count;i++){const x=Math.sin(i*127.1)*76,z=Math.cos(i*311.7)*56;let visible=terrainHeight(x,z)>.4&&BASES.every(b=>Math.hypot(x-b.x,z)>9)&&PIN_SPAWNS.every(p=>Math.hypot(x-p.x,z-p.z)>3);
    const scale=visible?.75+(i%5)*.18:0;dummy.position.set(x,terrainHeight(x,z)+1.4*scale,z);dummy.scale.setScalar(scale);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y+=2.4*scale;dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}
  trunks.castShadow=true;leaves.castShadow=true;scene.add(trunks,leaves);
  const rocks=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),stone,65);
  for(let i=0;i<65;i++){const x=Math.sin(i*54.3+4)*76,z=Math.cos(i*24.8)*56,s=.5+i%4*.5;dummy.position.set(x,terrainHeight(x,z)-.1,z);dummy.rotation.set(.2,i,0);dummy.scale.set(s,s*.7,s*.9);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);}rocks.castShadow=true;scene.add(rocks);
  return {terrain,cores,shields,water};
}
