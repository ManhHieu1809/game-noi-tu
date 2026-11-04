import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,stats,setInput,action,tick} from '../js/arena/core.js';
import {ITEMS,CLASSES,CORE_HP,BASES} from '../js/arena/data.js';
const make=(role='fighter')=>createMatch([{id:'a',name:'A',role,team:0},{id:'b',name:'B',role:'tank',team:1}]);
function step(s,seconds){for(let i=0;i<seconds*30;i++)tick(s,1/30);}
test('four distinct classes, eighteen unique items and separate inventories',()=>{
  assert.equal(Object.keys(CLASSES).length,4);assert.equal(ITEMS.length,18);assert.equal(new Set(ITEMS.map(i=>i.id)).size,18);
  const s=make();assert.notEqual(s.players[0].hp,s.players[1].hp);s.players[0].items.push('blade');assert.equal(s.players[1].items.length,0);
});
test('shop validates home, budget, three equipment and three potion limits',()=>{
  const s=make(),p=s.players[0];p.money=1000;
  for(const id of ['blade','plate','boots'])assert.equal(action(s,'a',{type:'buy',id}).ok,true);
  assert.equal(action(s,'a',{type:'buy',id:'staff'}).ok,false);assert.equal(action(s,'a',{type:'buy',id:'blade'}).ok,false);
  for(let i=0;i<3;i++)assert.equal(action(s,'a',{type:'buy',id:'heal'}).ok,true);
  assert.equal(action(s,'a',{type:'buy',id:'heal'}).ok,false);
  assert.equal(action(s,'a',{type:'sell',id:'plate'}).ok,true);assert.ok(p.hp<=stats(p).hp);
  p.x=0;assert.equal(action(s,'a',{type:'buy',id:'staff'}).ok,false);
});
test('pickup deposit currency and shield activation require earned energy',()=>{
  const s=make(),p=s.players[0];p.x=0;p.z=0;tick(s,1/30);assert.equal(p.pins,3);
  p.x=BASES[0].x;tick(s,1/30);assert.equal(p.pins,0);assert.equal(p.money,160);assert.equal(s.teams[0].charge,3);
  assert.equal(action(s,'a',{type:'activate'}).ok,false);s.teams[0].charge=18;
  assert.equal(action(s,'a',{type:'activate'}).ok,true);assert.equal(s.teams[1].exposed,35);assert.equal(s.teams[0].charge,0);
});
test('input rejects non-finite coordinates and stale sequence; stops after silence',()=>{
  const s=make(),p=s.players[0];setInput(s,'a',{seq:1,x:1,z:0,ax:0,az:0});const start=p.x;tick(s,.03);assert.ok(p.x>start);
  setInput(s,'a',{seq:0,x:-1,z:0,ax:0,az:0});assert.equal(p.input.x,1);
  setInput(s,'a',{seq:2,x:NaN,z:0,ax:0,az:0});assert.equal(p.seq,1);
  step(s,1);const stopped=p.x;step(s,1);assert.equal(p.x,stopped);
});
test('skills apply cooldowns, potions consume a slot and healing is bounded',()=>{
  for(const role of Object.keys(CLASSES)){const s=make(role),p=s.players[0];p.x=0;p.z=0;setInput(s,'a',{seq:1,x:0,z:0,ax:5,az:0});
    for(let slot=0;slot<3;slot++){assert.equal(action(s,'a',{type:'skill',slot}).ok,true);assert.equal(action(s,'a',{type:'skill',slot}).ok,false);}
    assert.equal(action(s,'a',{type:'skill',slot:99}).ok,false);assert.ok(s.shots.length<10);
  }
  const s=make(),p=s.players[0];p.potions=['heal','haste'];p.hp=20;action(s,'a',{type:'potion',slot:0});assert.equal(p.potions.length,1);assert.equal(action(s,'a',{type:'potion',slot:0}).ok,false);step(s,5);assert.ok(p.hp<=stats(p).hp);
});
test('closed core cannot be damaged; exposed core can be destroyed and ends match',()=>{
  const s=make(),p=s.players[0];p.x=BASES[1].x-2;p.z=0;
  setInput(s,'a',{seq:1,x:0,z:0,ax:BASES[1].x,az:0,fire:true});tick(s,.03);assert.equal(s.teams[1].hp,CORE_HP);
  p.attackCd=0;s.teams[1].exposed=35;s.teams[1].hp=1;tick(s,.03);assert.equal(s.phase,'ended');assert.equal(s.winner,0);
});
test('combat death drops carried energy and respawn preserves equipment',()=>{
  const s=make('ranger'),p=s.players[0],enemy=s.players[1];p.x=0;p.z=0;enemy.x=2;enemy.z=0;enemy.hp=1;enemy.pins=4;enemy.items=['plate'];
  setInput(s,'a',{seq:1,x:0,z:0,ax:2,az:0,fire:true});step(s,.3);assert.ok(enemy.respawn>0);assert.equal(enemy.pins,0);assert.equal(p.kills,1);assert.ok(s.pins.some(p=>p.drop));
  step(s,7);assert.equal(enemy.respawn,0);assert.equal(enemy.x,BASES[1].x);assert.deepEqual(enemy.items,['plate']);
});
test('match timeout compares health then deposits, supports a draw',()=>{
  const s=make();s.time=599.99;tick(s,.03);assert.equal(s.phase,'ended');assert.equal(s.winner,null);
  const t=make();t.teams[1].deposited=4;t.time=599.99;tick(t,.03);assert.equal(t.winner,1);
});
