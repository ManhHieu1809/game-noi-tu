import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ArenaRoom} from '../js/arena/network.js';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';

class Connection extends EventEmitter {
  constructor(peer){super();this.peer=peer;this.open=false;}
  send(m){if(this.open)queueMicrotask(()=>this.other.emit('data',structuredClone(m)));}
  close(){if(!this.open)return;this.open=false;this.other.open=false;this.emit('close');this.other.emit('close');}
}
class FakePeer extends EventEmitter {
  static registry=new Map();static serial=0;
  constructor(id){super();this.id=typeof id==='string'?id:`client-${++FakePeer.serial}`;FakePeer.registry.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id));}
  connect(id){const host=FakePeer.registry.get(id);const c=new Connection(id);if(!host){queueMicrotask(()=>this.emit('error',{type:'peer-unavailable'}));return c;}const h=new Connection(this.id);c.other=h;h.other=c;queueMicrotask(()=>{host.emit('connection',h);c.open=h.open=true;c.emit('open');h.emit('open');});return c;}
  destroy(){FakePeer.registry.delete(this.id);}
}
test('room handshake, 4-player limit, team selection, snapshots, actions and disconnect cancellation (mock transport)',async()=>{
  const previous=globalThis.window;globalThis.window={Peer:FakePeer};const rooms=[];
  try {
    let capturedInput,capturedAction,cancelled;
    const host=new ArenaRoom({input:(id,data)=>capturedInput={id,data},action:(id,data)=>capturedAction={id,data},closed:reason=>cancelled=reason});rooms.push(host);await host.open('Host');
    const clients=[];for(let i=0;i<3;i++){const c=new ArenaRoom({});rooms.push(c);await c.open('Guest'+i,host.code);clients.push(c);}
    assert.equal(host.members.length,4);assert.ok(host.peer.id.startsWith('arena-v1-'));
    const fifth=new ArenaRoom({});rooms.push(fifth);await assert.rejects(fifth.open('Fifth',host.code),/đủ 4/);
    clients[0].select('mage',0);await new Promise(r=>setImmediate(r));assert.equal(host.members.find(p=>p.id===clients[0].id).role,'mage');
    host.playing=true;let snapshot;clients[0].cb.state=s=>snapshot=s;
    host.broadcast({phase:'playing'},100);await new Promise(r=>setImmediate(r));assert.equal(snapshot.phase,'playing');
    clients[0].input({seq:1,x:1});clients[0].action({type:'skill',slot:0});await new Promise(r=>setImmediate(r));assert.equal(capturedInput.id,clients[0].id);assert.equal(capturedAction.data.slot,0);
    clients[0].conn.close();assert.match(cancelled,/mất kết nối/);
  } finally {for(const room of rooms)room.close();await new Promise(r=>setTimeout(r,300));globalThis.window=previous;}
});
test('arena local HTML, module imports and styles resolve below a repository subpath',()=>{
  const root=path.resolve('.'),html=readFileSync('arena.html','utf8');
  for(const m of html.matchAll(/(?:src|href)="([^"]+)"/g)){const url=m[1];if(!/^(https?:|#)/.test(url))assert.ok(existsSync(path.join(root,url)),url);}
  for(const file of ['boot','main','core','data','scene','network']){
    const source=readFileSync(`js/arena/${file}.js`,'utf8');
    for(const m of source.matchAll(/(?:from\s*|import\()['"](\.[^'"]+)/g))assert.ok(existsSync(path.resolve(root,'js/arena',m[1])),m[1]);
  }
  assert.ok(!readFileSync('js/app.js','utf8').includes('arena/'));
});
