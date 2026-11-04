import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../js/vendor/three.module.min.js';
import {WORLD,groundHeight,terrainHeight,riverZ,inWater} from '../js/arena/terrain.js';
import {findPath} from '../js/arena/navigation.js';
import {buildLandscape} from '../js/arena/landscape.js';
import {HumanHero} from '../js/arena/humanoid.js';
import {WALLS,BASES} from '../js/arena/data.js';
import {createMatch,action} from '../js/arena/core.js';
import {readFileSync} from 'node:fs';
test('large terrain has climbable hills, shallow river and solid bridges',()=>{
  assert.ok(WORLD.halfX*2>=160);assert.ok(terrainHeight(31,31)>8);
  assert.ok(inWater(0,riverZ(0)));assert.ok(groundHeight(25,riverZ(25))>.5);assert.equal(inWater(25,riverZ(25)),false);
  for(const b of BASES)assert.equal(groundHeight(b.x,b.z),1);
  for(let x=-75;x<75;x+=3)for(let z=-55;z<55;z+=3){assert.ok(Number.isFinite(groundHeight(x,z)));assert.ok(Math.abs(terrainHeight(x+.1,z)-terrainHeight(x,z))<.5);}
});
test('visible terrain vertices use the same height field as walking',()=>{
  const s=new T.Scene(),land=buildLandscape(s),p=land.terrain.geometry.attributes.position;
  assert.ok(p.count>10000);for(let i=0;i<p.count;i+=127)assert.ok(Math.abs(p.getY(i)-terrainHeight(p.getX(i),p.getZ(i)))<.0001);
  assert.equal(land.cores.length,2);assert.ok(s.children.some(o=>o.isInstancedMesh));
  s.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});
});
test('right click path avoids walls and reaches distant hill',()=>{
  const path=findPath({x:-20,z:-5},{x:30,z:30});assert.ok(path.length>10);const end=path.at(-1);assert.ok(Math.hypot(end.x-30,end.z-30)<2);
  for(const p of path)assert.ok(!WALLS.some(w=>Math.abs(p.x-w.x)<w.w/2+.48&&Math.abs(p.z-w.z)<w.d/2+.48));
  assert.deepEqual(findPath({x:NaN,z:0},{x:0,z:0}),[]);
});
test('humanoid has elbow/knee chains, visible equipment and follows ground height',()=>{
  const old=globalThis.document;globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
  try{const scene=new T.Scene(),p={id:'a',name:'A',role:'fighter',team:0,x:31,z:31,yaw:0,hp:140,maxHp:140,items:[]};const h=new HumanHero(p,scene);
    assert.equal(h.elbows[0].parent,h.arms[0]);assert.equal(h.knees[0].parent,h.legs[0]);
    h.update({...p,items:['plate','boots','pack']},1/30,true);assert.ok(h.itemNodes.length>=3);assert.ok(Math.abs(h.group.position.y-groundHeight(31,31)-.02)<.001);
    h.update({...p,items:[]},1/30,true);assert.equal(h.itemNodes.length,0);
    scene.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});
  }finally{globalThis.document=old;}
});
test('every class skill emits a typed visual event for all three slots',()=>{
  for(const role of ['fighter','tank','mage','ranger']){const s=createMatch([{id:'a',name:'A',role,team:0}]);for(let slot=0;slot<3;slot++){action(s,'a',{type:'skill',slot});assert.ok(s.events.some(e=>e.type==='skill'&&e.role===role&&e.slot===slot&&e.playerId==='a'));}}
});
test('generated skill and equipment atlases are local PNG assets',()=>{
  for(const file of ['assets/arena-skills.png','assets/arena-items.png']){const b=readFileSync(file);assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');assert.ok(b.readUInt32BE(16)>512);assert.ok(b.readUInt32BE(20)>512);}
});
