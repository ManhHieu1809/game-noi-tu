import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslandState, addPlayer, startGame, tickGame, updatePose, removePlayer, resetToLobby, chooseSpawn, sanitizePose } from '../js/island/core.js';
import { SWITCHES, CHECKPOINT, GOAL, platformsFor } from '../js/island/world-data.js';
import { createBody, stepBody } from '../js/island/physics.js';

function room(count = 2) {
  const s = createIslandState({hostId: 'host', hostName: 'Chủ', now: 1000});
  for (let i = 1; i < count; i++) addPlayer(s, {id: `p${i}`, name: `Bạn ${i}`});
  startGame(s, 1000);
  return s;
}
test('capacity, unique colors and lobby-only admission', () => {
  const s = createIslandState({hostId:'host', hostName:'Chủ'});
  for(let i=1;i<4;i++) assert.equal(addPlayer(s,{id:`p${i}`,name:'Bạn'}).ok,true);
  assert.equal(new Set(Object.values(s.players).map(p=>p.color)).size,4);
  assert.equal(addPlayer(s,{id:'fifth',name:'Bạn'}).ok,false);
  startGame(s);
  removePlayer(s,'p3');
  assert.equal(addPlayer(s,{id:'late',name:'Bạn'}).ok,false);
});
test('two separate switches charge and latch; checkpoint and all connected finish', () => {
  const s=room();
  updatePose(s,'host',SWITCHES[0]); updatePose(s,'p1',SWITCHES[0]);
  for(let i=0;i<30;i++) tickGame(s,2000+i*100,.1);
  assert.equal(s.switches.open,false);
  updatePose(s,'p1',SWITCHES[1]);
  for(let i=0;i<24;i++) tickGame(s,5000+i*100,.1);
  assert.equal(s.switches.open,true);
  updatePose(s,'host',CHECKPOINT); tickGame(s,8000,.1);
  assert.equal(s.checkpoint,true);
  assert.ok(chooseSpawn(s,'p1').z < -35);
  updatePose(s,'host',GOAL); tickGame(s,9000,.1);
  assert.equal(s.phase,'playing');
  removePlayer(s,'p1'); tickGame(s,9100,.1);
  assert.equal(s.phase,'ended');
  assert.equal(s.finishReason,'practice');
  resetToLobby(s); assert.equal(s.checkpoint,false); assert.equal(s.switches.open,false);
});
test('solo practice, falling respawn and no false checkpoint through closed bridge', () => {
  const s=room(); updatePose(s,'host',CHECKPOINT); tickGame(s,2000,.1);
  assert.equal(s.checkpoint,false);
  removePlayer(s,'p1'); assert.equal(s.practice,true); assert.equal(s.switches.open,true);
  updatePose(s,'host',{x:0,y:-15,z:-20}); tickGame(s,3000,.1);
  assert.ok(s.players.host.y>=0);
  const solo=room(1); assert.equal(solo.switches.open,true);
  assert.ok(Number.isFinite(sanitizePose({x:Infinity,y:NaN}).x));
});
test('floor landing, one jump per press, gravity and frame-rate stability', () => {
  for(const hz of [30,60,120]) {
    const b=createBody({x:0,y:2,z:10});
    for(let i=0;i<hz*2;i++) stepBody(b,{x:0,z:0},platformsFor(false),1/hz);
    assert.equal(b.y,0); assert.equal(b.grounded,true);
    stepBody(b,{jump:true},platformsFor(false),1/hz);
    assert.ok(b.vy>0);
    for(let i=0;i<hz*2;i++) stepBody(b,{},platformsFor(false),1/hz);
    assert.equal(b.y,0);
  }
});
