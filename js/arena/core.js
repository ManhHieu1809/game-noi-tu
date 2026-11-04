import {CLASSES,ITEMS,POTIONS,BASES,WALLS,PIN_SPAWNS,MATCH_SECONDS,CORE_HP,CHARGE_REQUIRED} from './data.js';
import {WORLD,groundHeight,inWater} from './terrain.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function stats(p){
  const s={...CLASSES[p.role],regen:0,cdr:0,lifesteal:0,penetration:0};
  for(const id of p.items) for(const [k,v] of Object.entries(ITEMS.find(i=>i.id===id)?.stats??{})) s[k]=(s[k]??0)+v;
  s.cdr=Math.min(.35,s.cdr); if(CLASSES[p.role].range<4)s.range=Math.min(s.range,3.2); return s;
}
export function createMatch(players,practice=false){
  return {time:0,phase:'playing',practice,winner:null,teams:BASES.map(()=>({hp:CORE_HP,charge:0,deposited:0,exposed:0})),
    players:players.map((p,i)=>{const role=CLASSES[p.role]?p.role:'fighter'; const team=p.team===1?1:0;
      return {id:p.id,name:String(p.name||'Người chơi').slice(0,18),role,team,bot:!!p.bot,x:BASES[team].x,z:i%2?2:-2,yaw:0,hp:CLASSES[role].hp,shield:0,shieldTime:0,items:[],potions:[],money:100,pins:0,kills:0,deaths:0,respawn:0,cd:[0,0,0],attackCd:0,dashCd:0,heal:0,haste:0,guard:0,rapid:0,potionCd:0,input:{x:0,z:0,ax:0,az:0},seq:-1};}),
    pins:PIN_SPAWNS.map((s,i)=>({...s,id:i,value:i===4?3:1,active:true,respawn:0})),shots:[],zones:[],events:[],nextId:100};
}
export function setInput(s,id,data){
  const p=s.players.find(p=>p.id===id); if(!p||!data||typeof data!=='object')return;
  if(!Number.isSafeInteger(data.seq)||data.seq<=p.seq)return;
  if(![data.x,data.z,data.ax,data.az].every(Number.isFinite))return;
  p.seq=data.seq; p.input={x:clamp(data.x,-1,1),z:clamp(data.z,-1,1),ax:clamp(data.ax,-WORLD.halfX,WORLD.halfX),az:clamp(data.az,-WORLD.halfZ,WORLD.halfZ),fire:!!data.fire}; p.inputAt=s.time;
}
function event(s,type,x,z,team=0,extra={}){s.events.push({id:s.nextId++,type,x,z,team,...extra});if(s.events.length>64)s.events.shift();}
function move(p,dx,dz){
  for(const axis of ['x','z']){p[axis]+=axis==='x'?dx:dz;const bound=axis==='x'?WORLD.halfX:WORLD.halfZ;p[axis]=clamp(p[axis],-bound+1,bound-1);
    for(const w of WALLS) if(Math.abs(p.x-w.x)<w.w/2+.48&&Math.abs(p.z-w.z)<w.d/2+.48)
      p[axis]=w[axis]+Math.sign(p[axis]-w[axis]||1)*((axis==='x'?w.w:w.d)/2+.48);
  }
}
export function predictPose(p,input,dt){
  if(p.respawn>0)return {x:p.x,z:p.z,yaw:p.yaw};
  const body={x:p.x,z:p.z},n=Math.max(1,Math.hypot(input.x,input.z));
  const speed=stats(p).speed*(p.haste>0?1.35:1)*(inWater(p.x,p.z)?.65:1);
  move(body,input.x/n*speed*dt,input.z/n*speed*dt);
  return {...body,yaw:Math.atan2(input.ax-body.x,input.az-body.z)};
}
function damage(s,target,amount,source,magic=false){
  if(target.respawn>0||target.id===source.id)return;
  const st=stats(target),atk=stats(source);
  let value=amount*100/(100+Math.max(0,(magic?st.resist:st.armor)-atk.penetration));
  if(target.guard>0)value*=.5;
  const absorb=Math.min(target.shield,value);target.shield-=absorb;value-=absorb;
  target.hp=Math.max(0,target.hp-value);target.heal=0;event(s,'hit',target.x,target.z,source.team);
  if(target.hp<=0){target.deaths++;source.kills++;source.money+=45;target.respawn=6;target.input={x:0,z:0,ax:0,az:0};
    if(target.pins) s.pins.push({id:s.nextId++,x:target.x,z:target.z,value:Math.max(1,Math.ceil(target.pins/2)),active:true,drop:true,respawn:0});
    target.pins=0;event(s,'down',target.x,target.z,target.team);
  }
}
function facing(p){const x=p.input.ax-p.x,z=p.input.az-p.z,n=Math.hypot(x,z)||1;return {x:x/n,z:z/n};}
function shoot(s,p,amount,range,speed=20,pierce=false,magic=false){const d=facing(p);s.shots.push({id:s.nextId++,owner:p.id,team:p.team,x:p.x,z:p.z,dx:d.x,dz:d.z,amount,life:range/speed,speed,pierce,magic,hit:[]});}
function area(s,p,r,amount,push=false){for(const t of s.players)if(t.team!==p.team&&dist(p,t)<r){damage(s,t,amount,p,p.role==='mage');if(push){const n=dist(p,t)||1;move(t,(t.x-p.x)/n*1.5,(t.z-p.z)/n*1.5);}}event(s,'blast',p.x,p.z,p.team);}
export function action(s,id,a){
  const p=s.players.find(p=>p.id===id);if(!p||s.phase!=='playing'||!a||typeof a!=='object')return {ok:false};
  const st=stats(p),home=dist(p,BASES[p.team])<3.6;
  if(p.respawn>0)return {ok:false,reason:'Đang hồi sinh.'};
  if(a.type==='buy'){
    const item=ITEMS.find(i=>i.id===a.id),pot=POTIONS.find(i=>i.id===a.id),v=item??pot;
    if(!home)return {ok:false,reason:'Hãy về căn cứ để mua đồ.'};
    if(!v||p.money<v.price)return {ok:false,reason:'Không đủ tiền.'};
    if(item&&(p.items.length>=3||p.items.includes(item.id)))return {ok:false,reason:'Chỉ có 3 ô và không mua trùng món. Bán một món trước.'};
    if(pot&&p.potions.length>=3)return {ok:false,reason:'Đã đủ 3 bình thuốc.'};
    p.money-=v.price;(item?p.items:p.potions).push(v.id);if(item)p.hp=Math.min(stats(p).hp,p.hp+(item.stats.hp??0));return {ok:true};
  }
  if(a.type==='sell'){
    const index=p.items.indexOf(a.id);if(!home||index<0)return {ok:false};
    p.items.splice(index,1);p.money+=Math.floor(ITEMS.find(i=>i.id===a.id).price*.65);p.hp=Math.min(p.hp,stats(p).hp);return {ok:true};
  }
  if(a.type==='activate'){
    const t=s.teams[p.team],enemy=s.teams[1-p.team];
    if(!home||t.charge<CHARGE_REQUIRED||enemy.exposed>0)return {ok:false,reason:'Cần 18 năng lượng, ở căn cứ và không có đợt công phá đang chạy.'};
    t.charge-=CHARGE_REQUIRED;enemy.exposed=35;event(s,'assault',0,0,p.team);return {ok:true};
  }
  if(a.type==='potion'){
    if(!Number.isInteger(a.slot)||p.potionCd>0||!p.potions[a.slot])return {ok:false};
    const id=p.potions.splice(a.slot,1)[0];p.potionCd=3;
    if(id==='heal')p.heal=4;if(id==='shield'){p.shield+=45;p.shieldTime=5;}if(id==='haste')p.haste=4;return {ok:true};
  }
  if(a.type==='dash'){
    if(p.dashCd>0)return {ok:false};const d=facing(p);for(let i=0;i<12;i++)move(p,d.x*.22,d.z*.22);p.dashCd=7;event(s,'dash',p.x,p.z,p.team);return {ok:true};
  }
  if(a.type!=='skill'||!Number.isInteger(a.slot)||a.slot<0||a.slot>2||p.cd[a.slot]>0)return {ok:false};
  const k=a.slot;p.cd[k]=st.cooldowns[k]*(1-st.cdr);const d=facing(p);
  if(p.role==='fighter'){
    if(k===0){for(let i=0;i<10;i++)move(p,d.x*.26,d.z*.26);area(s,p,2.8,30+st.attack*.8);}
    if(k===1)p.guard=3;
    if(k===2)area(s,p,4.5,45+st.attack,true);
  }else if(p.role==='tank'){
    if(k===0){for(let i=0;i<10;i++)move(p,d.x*.24,d.z*.24);area(s,p,2.7,28+st.attack,true);}
    if(k===1)for(const t of s.players)if(t.team===p.team&&!t.respawn&&dist(p,t)<5){t.shield+=40;t.shieldTime=5;}
    if(k===2)s.zones.push({id:s.nextId++,x:p.x,z:p.z,team:p.team,type:'barrier',life:5,r:4});
  }else if(p.role==='mage'){
    if(k===0)shoot(s,p,25+st.power*.9,13,17,false,true);
    if(k>0){const n=Math.min(8,Math.hypot(p.input.ax-p.x,p.input.az-p.z));s.zones.push({id:s.nextId++,x:p.x+d.x*n,z:p.z+d.z*n,team:p.team,owner:p.id,type:k===1?'slow':'storm',life:k===1?5:4,r:3,age:0,tick:0,power:st.power});}
  }else{
    if(k===0)shoot(s,p,30+st.attack*1.2,16,28,true);
    if(k===1)for(let i=0;i<12;i++)move(p,-d.x*.2,-d.z*.2);
    if(k===2)p.rapid=5;
  }
  event(s,'skill',p.x,p.z,p.team,{role:p.role,slot:k,playerId:p.id,yaw:p.yaw});return {ok:true};
}
function attack(s,p){
  const st=stats(p);if(p.attackCd>0)return;p.attackCd=1/(st.rate*(p.rapid>0?1.8:1));event(s,'attack',p.x,p.z,p.team);
  if(st.range<4){const d=facing(p);for(const t of s.players)if(t.team!==p.team&&dist(p,t)<st.range&&!t.respawn){const dx=t.x-p.x,dz=t.z-p.z;if(dx*d.x+dz*d.z>-.1){const before=t.hp;damage(s,t,st.attack,p);p.hp=Math.min(st.hp,p.hp+Math.max(0,before-t.hp)*st.lifesteal);}}}
  else shoot(s,p,st.attack,st.range,24,false,p.role==='mage');
  const enemy=1-p.team,b=BASES[enemy];
  if(st.range<4&&s.teams[enemy].exposed>0&&dist(p,b)<st.range+1.1){const d=facing(p);if((b.x-p.x)*d.x+(b.z-p.z)*d.z>0)s.teams[enemy].hp=Math.max(0,s.teams[enemy].hp-st.attack);}
}
function bot(s,p){
  const enemy=s.players.filter(t=>t.team!==p.team&&!t.respawn).sort((a,b)=>dist(p,a)-dist(p,b))[0];
  let target=BASES[p.team];
  if(s.teams[1-p.team].exposed>0)target=BASES[1-p.team];
  else if(p.pins<stats(p).capacity)target=s.pins.filter(a=>a.active).sort((a,b)=>dist(p,a)-dist(p,b))[0]??target;
  if(enemy&&dist(p,enemy)<7)target=enemy;
  let dx=target.x-p.x,dz=target.z-p.z,n=Math.hypot(dx,dz)||1;
  p.input={x:dx/n,z:dz/n,ax:target.x,az:target.z,fire:!!enemy&&dist(p,enemy)<stats(p).range};p.inputAt=s.time;
  // Simple wall avoidance; these bots are training opponents, not competitive AI.
  if(WALLS.some(w=>Math.abs(p.x+dx/n-w.x)<w.w/2+.7&&Math.abs(p.z+dz/n-w.z)<w.d/2+.7)){p.input.x=0;p.input.z=p.z>=0?1:-1;}
  if(enemy&&dist(p,enemy)<6){action(s,p.id,{type:'skill',slot:0});action(s,p.id,{type:'skill',slot:2});if(p.hp<stats(p).hp*.5)action(s,p.id,{type:'skill',slot:1});}
  if(dist(p,BASES[p.team])<3.6){action(s,p.id,{type:'activate'});if(p.items.length<3){const ids=p.role==='mage'?['staff','coil','plate']:['blade','plate','boots'];action(s,p.id,{type:'buy',id:ids[p.items.length]});}}
}
export function tick(s,delta){
  if(s.phase!=='playing')return;const dt=clamp(delta,0,.05);s.time+=dt;
  for(const t of s.teams)t.exposed=Math.max(0,t.exposed-dt);
  for(const p of s.players){
    const st=stats(p);for(const k of ['attackCd','dashCd','shieldTime','heal','haste','guard','rapid','potionCd'])p[k]=Math.max(0,p[k]-dt);
    p.cd=p.cd.map(c=>Math.max(0,c-dt));if(!p.shieldTime)p.shield=0;
    if(p.respawn>0){p.respawn=Math.max(0,p.respawn-dt);if(!p.respawn){p.x=BASES[p.team].x;p.z=0;p.hp=st.hp;}continue;}
    if(p.bot)bot(s,p);
    if(s.time-(p.inputAt??0)>.4)p.input={x:0,z:0,ax:p.x,az:p.z};
    const v=p.input,n=Math.max(1,Math.hypot(v.x,v.z));let speed=st.speed*(p.haste>0?1.35:1)*(inWater(p.x,p.z)?.65:1);
    if(s.zones.some(z=>z.type==='slow'&&z.team!==p.team&&dist(z,p)<z.r))speed*=.55;
    move(p,v.x/n*speed*dt,v.z/n*speed*dt);p.yaw=Math.atan2(v.ax-p.x,v.az-p.z);
    if(v.fire)attack(s,p);
    p.hp=Math.min(st.hp,p.hp+(st.regen+(p.heal>0?12:0))*dt);
    for(const pin of s.pins)if(pin.active&&dist(p,pin)<1&&p.pins<st.capacity){const take=Math.min(pin.value,st.capacity-p.pins);p.pins+=take;pin.value-=take;if(pin.value<=0){pin.active=false;pin.respawn=pin.id===4?24:12;}event(s,'pickup',p.x,p.z,p.team);}
    if(dist(p,BASES[p.team])<3){p.hp=Math.min(st.hp,p.hp+16*dt);if(p.pins){const t=s.teams[p.team];t.charge+=p.pins;t.deposited+=p.pins;p.money+=p.pins*20;p.pins=0;event(s,'deposit',p.x,p.z,p.team);}}
  }
  for(const shot of s.shots){const old={x:shot.x,z:shot.z};shot.x+=shot.dx*shot.speed*dt;shot.z+=shot.dz*shot.speed*dt;shot.life-=dt;
    if(WALLS.some(w=>Math.abs(shot.x-w.x)<w.w/2&&Math.abs(shot.z-w.z)<w.d/2)||s.zones.some(z=>z.type==='barrier'&&z.team!==shot.team&&dist(z,shot)<z.r))shot.life=0;
    const source=s.players.find(p=>p.id===shot.owner);if(!source||shot.life<=0)continue;
    const core=BASES[1-shot.team];
    if(s.teams[1-shot.team].exposed>0&&dist(shot,core)<1.4){s.teams[1-shot.team].hp=Math.max(0,s.teams[1-shot.team].hp-shot.amount);shot.life=0;continue;}
    for(const t of s.players)if(t.team!==shot.team&&!t.respawn&&!shot.hit.includes(t.id)){
      const dx=shot.x-old.x,dz=shot.z-old.z,l=dx*dx+dz*dz,u=clamp(((t.x-old.x)*dx+(t.z-old.z)*dz)/(l||1),0,1);
      if(Math.hypot(t.x-old.x-dx*u,t.z-old.z-dz*u)<.65){damage(s,t,shot.amount,source,shot.magic);shot.hit.push(t.id);if(shot.magic&&source.role==='mage')for(const other of s.players)if(other.id!==t.id&&other.team!==source.team&&dist(t,other)<2)damage(s,other,shot.amount*.5,source,true);if(source.hp>0)source.hp=Math.min(stats(source).hp,source.hp+shot.amount*stats(source).lifesteal);if(!shot.pierce){shot.life=0;break;}}
    }
  }
  s.shots=s.shots.filter(p=>p.life>0);
  for(const z of s.zones){z.life-=dt;z.age=(z.age??0)+dt;z.tick=(z.tick??0)+dt;
    if(z.type==='storm'&&z.age>.8&&z.tick>.5){z.tick=0;const source=s.players.find(p=>p.id===z.owner);if(source)for(const p of s.players)if(p.team!==z.team&&dist(p,z)<z.r)damage(s,p,12+z.power*.25,source,true);}
  }s.zones=s.zones.filter(z=>z.life>0);
  for(const pin of s.pins)if(!pin.active&&!pin.drop){pin.respawn-=dt;if(pin.respawn<=0){pin.active=true;pin.value=pin.id===4?3:1;}}
  s.pins=s.pins.filter(p=>!p.drop||p.active);
  if(s.teams.some(t=>t.hp<=0)||s.time>=MATCH_SECONDS){s.phase='ended';const a=s.teams[0],b=s.teams[1];s.winner=a.hp!==b.hp?(a.hp>b.hp?0:1):a.deposited!==b.deposited?(a.deposited>b.deposited?0:1):null;}
}
