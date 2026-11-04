import {ArenaScene} from './scene.js';
import {CLASSES,ITEMS,POTIONS,BASES,CORE_HP,MATCH_SECONDS,CHARGE_REQUIRED,STAT_LABELS} from './data.js';
import {createMatch,tick,stats,setInput,action,predictPose} from './core.js';
import {ArenaRoom} from './network.js';
import {findPath} from './navigation.js';
import {WORLD,groundHeight} from './terrain.js';
import {CharacterPreview} from './humanoid.js';
const $=id=>document.getElementById(id);
const app={room:null,state:null,localId:null,practice:false,keys:new Set(),fire:false,mouse:{x:innerWidth/2,y:innerHeight/2},seq:0,lastInput:0,lastHud:0,lastFrame:0,accumulator:0,raf:0,disposed:false,low:false,noticeTimer:null,busy:false,ended:false};
const view=new ArenaScene($('viewport'));
const events=new AbortController();const on=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:events.signal});
function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(app.noticeTimer);app.noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),4500);}
function local(){return app.state?.players.find(p=>p.id===app.localId);}
function clearInput(){app.keys.clear();app.fire=false;app.path=[];view.destination.visible=false;}
function inputBlocked(){return $('shop').open||$('helpDialog').open||$('result').open;}
function command(a){if(app.state?.phase!=='playing')return;if(app.practice){const r=action(app.state,app.localId,a);if(r.reason)notice(r.reason);}else app.room?.action(a);renderHud();}
function roleInfo(){const c=CLASSES[$('role').value];$('roleInfo').textContent=`${c.hp} máu · ${c.armor} giáp · ${c.resist} kháng phép\n${c.skills.join(' / ')}`;}
function text(tag,content,className){const e=document.createElement(tag);e.textContent=content;if(className)e.className=className;return e;}
function icon(kind,index){const e=document.createElement('span');e.className=`game-icon ${kind}`;const columns=kind==='item-icon'?6:4,rows=kind==='item-icon'?3:4;e.style.backgroundPosition=`${index%columns/(columns-1)*100}% ${Math.floor(index/columns)/(rows-1)*100}%`;e.setAttribute('aria-hidden','true');return e;}
function renderLobby(members){
  $('entry').hidden=true;$('lobby').hidden=false;$('leave').hidden=false;$('roomCode').textContent=app.room?.code??'';
  const list=$('roster');list.replaceChildren();for(const p of members){const row=document.createElement('div');row.append(text('strong',`${p.team+1} / ${p.name}`,p.team?'amber':'teal'),text('span',CLASSES[p.role]?.name??'?'));list.append(row);}
  const me=members.find(p=>p.id===app.room?.id);if(me){$('team').value=me.team;$('lobbyRole').value=me.role;}
  const ready=members.length===4&&[0,1].every(team=>{const ps=members.filter(p=>p.team===team);return ps.length===2&&new Set(ps.map(p=>p.role)).size===2;});
  $('start').hidden=!app.room?.host;$('start').disabled=!ready;$('lobbyInfo').textContent=ready?'Đội hình sẵn sàng. Chủ phòng có thể bắt đầu.':'Cần đủ 4 người, mỗi đội 2 người và không trùng chức nghiệp.';
}
function setupShop(){
  const root=$('shopItems');root.replaceChildren();
  for(const v of [...ITEMS,...POTIONS]){const b=document.createElement('button');b.dataset.item=v.id;b.append(icon(ITEMS.includes(v)?'item-icon':'skill-icon',ITEMS.includes(v)?ITEMS.indexOf(v):12+POTIONS.indexOf(v)),text('b',`${v.price} ¤`),text('strong',v.name),text('small',v.description));
    if(ITEMS.includes(v))on(b,'mouseenter',()=>{const p=local();if(!p)return;const st=stats(p);const after=stats({...p,items:[...p.items,v.id]});const format=(k,value)=>['cdr','lifesteal'].includes(k)?Math.round(value*100)+'%':Math.round(value*100)/100;$('shopStats').textContent=Object.keys(v.stats).map(k=>`${STAT_LABELS[k]}: ${format(k,st[k]??0)} → ${format(k,after[k]??0)}`).join(' · ');});
    on(b,'click',()=>command({type:'buy',id:v.id}));root.append(b);}
}
function enterMatch(state){
  app.state=state;app.ended=false;app.accumulator=0;clearInput();$('entry').hidden=true;$('lobby').hidden=true;$('hud').hidden=false;$('leave').hidden=false;
  if($('result').open)$('result').close();notice(app.practice?'Luyện tập cùng bot. Nhặt pin, về nhà nạp và mua trang bị.':'Trận bắt đầu! Thu thập pin và bảo vệ lõi của đội.');renderHud();
}
function receive(state){
  if(!state||!Array.isArray(state.players)||state.players.length>4||!Array.isArray(state.teams)||state.teams.length!==2)return;
  if(!app.state||(app.state.phase==='ended'&&state.phase==='playing')){app.prediction=null;enterMatch(state);}else app.state=state;
  const p=state.players.find(p=>p.id===app.localId);
  if(p&&app.prediction){const d=Math.hypot(p.x-app.prediction.x,p.z-app.prediction.z);if(d>2||p.respawn>0)app.prediction={x:p.x,z:p.z,yaw:p.yaw};else{app.prediction.x+=(p.x-app.prediction.x)*.25;app.prediction.z+=(p.z-app.prediction.z)*.25;}}
}
async function connect(code){
  if(app.busy)return;app.busy=true;$('entryError').textContent='';$('create').disabled=$('join').disabled=$('practice').disabled=true;
  const name=$('name').value.trim().slice(0,18)||'Người chơi';
  const room=new ArenaRoom({lobby:renderLobby,state:receive,input:(id,input)=>{if(app.state)setInput(app.state,id,input);},
    action:(id,a)=>{if(app.state){const r=action(app.state,id,a);if(r.reason)room.notice(id,r.reason);}},notice,
    closed:reason=>{reset();notice(reason);}});
  app.room=room;app.practice=false;
  try{await room.open(name,code);app.localId=room.id;room.select($('role').value,0);$('roomCode').textContent=room.code;renderLobby(room.members);}
  catch(e){$('entryError').textContent=e.message;reset();}
  finally{app.busy=false;$('create').disabled=$('join').disabled=$('practice').disabled=false;}
}
function practice(){
  app.practice=true;app.localId='local';const role=$('role').value;
  const other=Object.keys(CLASSES).filter(r=>r!==role)[0];
  enterMatch(createMatch([{id:'local',name:$('name').value.trim()||'Bạn',role,team:0},{id:'bot0',name:'Mica / BOT',role:other,team:0,bot:true},{id:'bot1',name:'Ember / BOT',role:'tank',team:1,bot:true},{id:'bot2',name:'Volt / BOT',role:'ranger',team:1,bot:true}],true));
}
function reset(){
  const old=app.room;app.room=null;old?.close();app.state=null;app.prediction=null;app.localId=null;app.practice=false;app.ended=false;clearInput();
  for(const id of ['shop','result'])if($(id).open)$(id).close();$('entry').hidden=false;$('lobby').hidden=true;$('hud').hidden=true;$('leave').hidden=true;
}
function renderHud(){
  const s=app.state,p=local();if(!s||!p)return;const st=stats(p);
  if(p.respawn>0){app.path=[];view.destination.visible=false;}
  $('timer').textContent=`${String(Math.floor(Math.max(0,MATCH_SECONDS-s.time)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,MATCH_SECONDS-s.time)%60)).padStart(2,'0')}`;
  $('matchType').textContent=s.practice?'LUYỆN TẬP / BOT':'2 VS 2';
  s.teams.forEach((t,i)=>{$(`core${i}`).textContent=`${Math.ceil(t.hp)} / ${CORE_HP}`;$(`energy${i}`).textContent=t.exposed>0?`KHIÊN HẠ · ${Math.ceil(t.exposed)}s`:`${t.charge} / ${CHARGE_REQUIRED} ⚡ · Khiên bật`;});
  const enemy=s.teams[1-p.team],home=Math.hypot(p.x-BASES[p.team].x,p.z)<3.6;
  $('objective').textContent=p.respawn>0?`Đang hồi sinh · ${Math.ceil(p.respawn)} giây`:enemy.exposed>0?`CÔNG PHÁ! Khiên địch hạ còn ${Math.ceil(enemy.exposed)} giây.`:s.teams[p.team].exposed>0?'PHÒNG THỦ! Lõi đội đang mất khiên.':s.teams[p.team].charge>=18?'Đủ năng lượng! Về căn cứ kích hoạt công phá.':'Nhặt pin ở các trạm → về vòng căn cứ để nạp.';
  $('heroName').textContent=`${CLASSES[p.role].name.toUpperCase()} / ${p.name}`;
  $('healthFill').style.transform=`scaleX(${Math.max(0,p.hp/st.hp)})`;$('healthText').textContent=`${Math.ceil(p.hp)} / ${st.hp} HP${p.shield>0?` + ${Math.ceil(p.shield)} khiên`:''}`;
  $('money').textContent=`${p.money} ¤`;$('pins').textContent=`${p.pins} / ${st.capacity} ⚡`;
  const equip=$('equipment');equip.replaceChildren();for(let i=0;i<3;i++){const item=ITEMS.find(v=>v.id===p.items[i]);const b=document.createElement('button');b.append(icon(item?'item-icon':'skill-icon',item?ITEMS.indexOf(item):15),text('small',item?.name??'Ô trống'));b.title=item?.description??'Mua trang bị ở căn cứ';b.onclick=()=>shop();equip.append(b);}
  const skills=$('skills');skills.replaceChildren();CLASSES[p.role].skills.forEach((name,i)=>{const b=document.createElement('button');b.append(icon('skill-icon',Object.keys(CLASSES).indexOf(p.role)*3+i),text('kbd',['Q','E','R'][i]),text('small',name));if(p.cd[i]>0)b.append(text('strong',Math.ceil(p.cd[i])+'s','cooldown'));b.title=`${name} · Hồi ${CLASSES[p.role].cooldowns[i]} giây`;b.disabled=p.cd[i]>0||p.respawn>0;b.onclick=()=>command({type:'skill',slot:i});skills.append(b);});
  const potions=$('potions');potions.replaceChildren();for(let i=0;i<3;i++){const v=POTIONS.find(v=>v.id===p.potions[i]);const b=document.createElement('button');b.append(icon('skill-icon',v?12+POTIONS.indexOf(v):15),text('kbd',String(i+1)));b.title=v?.description??'Ô thuốc trống';b.disabled=!v||p.potionCd>0;b.onclick=()=>command({type:'potion',slot:i});potions.append(b);}
  $('characterStats').replaceChildren(...['hp','attack','power','armor','resist','speed','rate','range','cdr','regen','lifesteal','capacity'].map(k=>{const value=['cdr','lifesteal'].includes(k)?Math.round(st[k]*100)+'%':Math.round(st[k]*100)/100;return text('div',`${STAT_LABELS[k]}: ${value}`);}));
  drawMinimap(s,p);
  $('players').replaceChildren(...s.players.map(v=>text('p',`${v.name} · ${CLASSES[v.role].name}\n${v.respawn>0?'Hồi sinh '+Math.ceil(v.respawn)+'s':Math.ceil(v.hp)+' HP'} · ${v.kills}/${v.deaths}`,v.team?'amber':'teal')));
  $('assault').disabled=!home||s.teams[p.team].charge<18||enemy.exposed>0||p.respawn>0;$('shopBtn').disabled=!home||p.respawn>0;
  if($('shop').open){
    if(!home||p.respawn>0){$('shop').close();notice('Đã rời vùng cửa hàng.');}
    $('sellSlots').replaceChildren(...p.items.map(id=>{const v=ITEMS.find(v=>v.id===id),b=text('button',`Bán ${v.name} +${Math.floor(v.price*.65)} ¤`);b.onclick=()=>command({type:'sell',id});return b;}));
    for(const b of $('shopItems').children){const v=[...ITEMS,...POTIONS].find(v=>v.id===b.dataset.item);b.disabled=p.money<v.price||(ITEMS.includes(v)?p.items.length>=3||p.items.includes(v.id):p.potions.length>=3);}
  }
  if(s.phase==='ended'&&!app.ended){app.ended=true;clearInput();if($('shop').open)$('shop').close();$('resultTitle').textContent=s.winner===null?'Hai đội hòa nhau':s.winner===p.team?'Đội bạn chiến thắng!':'Lõi đội đã thất thủ';$('resultText').textContent=`${s.practice?'Luyện tập với bot — không tính kết quả thi đấu.':'Trận đấu kết thúc.'} Bạn có ${p.kills} hạ gục / ${p.deaths} lần bị hạ. Tổng pin nạp: ${s.teams[p.team].deposited}.`;$('replay').hidden=!(app.practice||app.room?.host);$('result').showModal();}
}
function shop(){const p=local();if(!p||p.respawn>0||Math.hypot(p.x-BASES[p.team].x,p.z)>3.6){notice('Về căn cứ để mở cửa hàng.');return;}if($('shop').open)$('shop').close();else{clearInput();$('shop').showModal();$('shopStats').textContent=`${p.money} ¤ · ${stats(p).hp} máu · ${stats(p).attack} công · ${stats(p).power} phép`;renderHud();}}
function sendInput(now){
  if(!app.state||now-app.lastInput<50)return;app.lastInput=now;const aim=view.aimAt(app.mouse.x,app.mouse.y),blocked=inputBlocked();
  const input={seq:++app.seq,x:blocked?0:Number(app.keys.has('KeyD'))-Number(app.keys.has('KeyA')),z:blocked?0:Number(app.keys.has('KeyS'))-Number(app.keys.has('KeyW')),...aim,fire:!blocked&&app.fire};
  if(input.x||input.z){app.path=[];view.destination.visible=false;}
  const p=app.prediction??local();
  if(!blocked&&p&&app.path?.length){while(app.path.length&&Math.hypot(app.path[0].x-p.x,app.path[0].z-p.z)<.55)app.path.shift();const next=app.path[0];if(next){const d=Math.hypot(next.x-p.x,next.z-p.z);input.x=(next.x-p.x)/d;input.z=(next.z-p.z)/d;if(!app.fire){input.ax=next.x;input.az=next.z;}}else view.destination.visible=false;}
  app.latestInput=input;
  if(app.practice)setInput(app.state,app.localId,input);else app.room?.input(input);
}
function frame(now){if(app.disposed)return;const dt=Math.min(.1,app.lastFrame?(now-app.lastFrame)/1000:1/60);app.lastFrame=now;sendInput(now);
  if($('shop').open&&local()){if(!app.portrait&&!app.portraitFailed)try{app.portrait=new CharacterPreview($('portrait'));}catch{app.portraitFailed=true;notice('Không mở được xem trước nhân vật. Trang bị vẫn hiện trên nhân vật trong trận.');}app.portrait?.render({...local(),maxHp:stats(local()).hp},dt);}else if(app.portrait){app.portrait.dispose();app.portrait=null;}
  if(app.state&&(app.practice||app.room?.host)){app.accumulator=Math.min(.15,app.accumulator+dt);while(app.accumulator>=1/30){tick(app.state,1/30);app.accumulator-=1/30;}app.room?.broadcast(app.state,now);}
  if(now-app.lastHud>120){app.lastHud=now;renderHud();}
  if(app.room&&!app.room.host&&local()&&app.latestInput){const p=local();app.prediction=predictPose({...p,...(app.prediction??{})},app.latestInput,dt);}
  const renderState=app.state?{...app.state,players:app.state.players.map(p=>({...p,...(p.id===app.localId&&!app.practice&&!app.room?.host?app.prediction:{}),maxHp:stats(p).hp}))}:null;
  view.render(renderState,app.localId,dt,$('role').value);app.raf=requestAnimationFrame(frame);
}
function drawMinimap(s,p){const canvas=$('minimap'),c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;const point=p=>[(p.x+WORLD.halfX)/(WORLD.halfX*2)*w,(p.z+WORLD.halfZ)/(WORLD.halfZ*2)*h];c.fillStyle='#172f2d';c.fillRect(0,0,w,h);c.strokeStyle='#428c98';c.lineWidth=6;c.beginPath();for(let x=-80;x<=80;x+=4){const z=9*Math.sin(x*.045)+3*Math.sin(x*.09),a=point({x,z});if(x===-80)c.moveTo(...a);else c.lineTo(...a);}c.stroke();for(const b of BASES){const a=point(b);c.fillStyle=b.x<0?'#69daca':'#ffb568';c.fillRect(a[0]-4,a[1]-4,8,8);}for(const pin of s.pins)if(pin.active){const a=point(pin);c.fillStyle='#ebd68d';c.fillRect(a[0]-1,a[1]-1,2,2);}for(const hero of s.players)if(!hero.respawn){c.beginPath();c.fillStyle=hero.team?'#ffb568':'#69daca';c.arc(...point(hero),hero.id===p.id?4:2.5,0,Math.PI*2);c.fill();}c.strokeStyle='#eef6d0';c.strokeRect(...point({x:p.x-13,z:p.z-10}),26/160*w,20/120*h);}
on($('practice'),'click',practice);on($('create'),'click',()=>connect());on($('join'),'click',()=>connect($('code').value));on($('role'),'change',roleInfo);
$('lobbyRole').innerHTML=$('role').innerHTML;
for(const id of ['team','lobbyRole'])on($(id),'change',()=>app.room?.select($('lobbyRole').value,Number($('team').value)));
on($('start'),'click',()=>{if(!app.room?.host)return;app.room.playing=true;enterMatch(createMatch(app.room.members));});
on($('leave'),'click',()=>{if(confirm('Rời phòng? Trận đang chơi sẽ bị hủy cho mọi người.'))reset();});
on($('assault'),'click',()=>command({type:'activate'}));on($('shopBtn'),'click',shop);on($('closeShop'),'click',()=>$('shop').close());
on($('help'),'click',()=>{clearInput();$('helpDialog').showModal();});on($('closeHelp'),'click',()=>$('helpDialog').close());
on($('returnEntry'),'click',reset);on($('replay'),'click',()=>{if(app.practice)practice();else if(app.room?.host)enterMatch(createMatch(app.room.members));});
on($('quality'),'click',()=>{app.low=!app.low;view.quality(app.low);$('quality').textContent=`Đồ họa: ${app.low?'Thấp':'Vừa'}`;});
on(window,'keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
  if(!app.state||inputBlocked())return;
  if(['KeyW','KeyA','KeyS','KeyD','Space','KeyQ','KeyE','KeyR','Digit1','Digit2','Digit3','KeyB'].includes(e.code))e.preventDefault();
  app.keys.add(e.code);if(e.repeat)return;
  const skill=['KeyQ','KeyE','KeyR'].indexOf(e.code);if(skill>=0)command({type:'skill',slot:skill});
  const pot=['Digit1','Digit2','Digit3'].indexOf(e.code);if(pot>=0)command({type:'potion',slot:pot});
  if(e.code==='Space')command({type:'dash'});if(e.code==='KeyB')shop();
});
on(window,'keyup',e=>app.keys.delete(e.code));on(window,'blur',clearInput);
on(document,'visibilitychange',()=>{if(document.hidden)clearInput();});
on(window,'pointermove',e=>{app.mouse={x:e.clientX,y:e.clientY};});on(view.renderer.domElement,'pointerdown',e=>{if(e.button===0&&!inputBlocked())app.fire=true;});on(window,'pointerup',()=>app.fire=false);
on(view.renderer.domElement,'contextmenu',e=>{e.preventDefault();if(!local()||inputBlocked()||local().respawn>0)return;const aim=view.aimAt(e.clientX,e.clientY);app.path=findPath(app.prediction??local(),{x:aim.ax,z:aim.az});if(app.path.length){const end=app.path.at(-1);view.destination.position.set(end.x,groundHeight(end.x,end.z)+.1,end.z);view.destination.visible=true;}});
on(view.renderer.domElement,'wheel',e=>{e.preventDefault();view.zoom=Math.max(12,Math.min(40,(view.zoom??24)+e.deltaY*.015));},{passive:false});
on(window,'resize',()=>view.resize());
on(window,'beforeunload',e=>{if(app.room&&!app.room.closed){e.preventDefault();e.returnValue='';}});
function dispose(){if(app.disposed)return;app.disposed=true;cancelAnimationFrame(app.raf);clearTimeout(app.noticeTimer);events.abort();app.room?.close();app.portrait?.dispose();view.dispose();}
on(window,'pagehide',dispose);window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
on($('home'),'click',e=>{if(app.room&&!confirm('Quay về nối từ và đóng kết nối trận hiện tại?'))e.preventDefault();});
setupShop();roleInfo();$('loading').hidden=true;
if(matchMedia('(pointer:coarse)').matches){$('practice').disabled=$('create').disabled=$('join').disabled=true;$('entryError').textContent='Bản thử này cần máy tính có bàn phím và chuột.';}
app.raf=requestAnimationFrame(frame);
