
'use strict';
const D={run:{name:'Chạy',count:8,ticks:[4,4,4,4,4,4,4,4],loop:true},attack:{name:'Đánh kiếm',count:6,ticks:[5,6,4,3,5,7],loop:false}};
const el=id=>document.getElementById(id),ctx=el('player').getContext('2d'),cache=new Map();
let action='run',frame=0,elapsed=0,hold=0,paused=false,ready=false,last=performance.now(),size=192,bank=null,loadVersion=0;
function pathFor(which,key,i,n){const base=which==='before'?'../batch-03/final':'final-v2';return `${base}/${n===192?'lite/':''}${key}-se/${key}-${i+1}.png`;}
async function load(n){
 if(cache.has(n))return cache.get(n);
 const result={};
 await Promise.all(['before','after'].flatMap(which=>Object.entries(D).map(async([key,d])=>{
  result[`${which}-${key}`]=await Promise.all(Array.from({length:d.count},(_,i)=>new Promise((resolve,reject)=>{
   const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Không tải được ${pathFor(which,key,i,n)}`));image.src=pathFor(which,key,i,n);
  })));
 })));
 cache.set(n,result);return result;
}
function setPaused(value){paused=value;el('pause').textContent=value?'Tiếp tục':'Tạm dừng';}
function strip(){
 el('frames').replaceChildren();el('scrub').max=D[action].count-1;
 for(let i=0;i<D[action].count;i++){
  const button=document.createElement('button'),image=document.createElement('img'),span=document.createElement('span');
  image.src=bank[`after-${action}`][i].src;image.alt=`Bản mới ${D[action].name} frame ${i+1}`;
  span.textContent=`${i+1}${action==='attack'&&i===3?' · chém':''}`;
  button.append(image,span);button.onclick=()=>{frame=i;elapsed=0;hold=0;setPaused(true);draw();};el('frames').append(button);
 }
}
function draw(){
 if(!ready||!bank)return;ctx.clearRect(0,0,920,360);ctx.imageSmoothingEnabled=true;
 for(const[which,x]of[['before',230],['after',690]]){
  ctx.drawImage(bank[`${which}-${action}`][frame],x-192,305-365,384,384);
  if(el('root').checked){ctx.strokeStyle='#ffefab';ctx.beginPath();ctx.moveTo(x-8,305);ctx.lineTo(x+8,305);ctx.moveTo(x,297);ctx.lineTo(x,313);ctx.stroke();}
 }
 el('status').value=`${D[action].name} · ${frame+1}/${D[action].count} · ${size}px${paused?' · dừng':''}`;
 el('scrub').value=frame;[...el('frames').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===frame)));
}
function select(next){if(!ready)return;action=next;frame=0;elapsed=0;hold=0;setPaused(false);for(const key of Object.keys(D))el(key).setAttribute('aria-pressed',String(key===next));strip();draw();}
function tick(now){
 const dt=Math.min(100,Math.max(0,now-last));last=now;
 if(ready&&!paused&&!document.hidden){
  const d=D[action];elapsed+=dt*Number(el('speed').value);
  if(hold>0){hold-=dt*Number(el('speed').value);if(hold<=0){frame=0;elapsed=0;}}
  else while(elapsed>=d.ticks[frame]*1000/60){
   elapsed-=d.ticks[frame]*1000/60;
   if(frame+1<d.count)frame++;
   else if(d.loop&&el('repeat').checked)frame=0;
   else if(!d.loop&&el('repeat').checked){hold=500;elapsed=0;break;}
   else{setPaused(true);elapsed=0;break;}
  }
  draw();
 }
 requestAnimationFrame(tick);
}
async function changeQuality(){
 const version=++loadVersion;ready=false;el('status').value='Đang tải ảnh…';
 try{const n=Number(el('quality').value),loaded=await load(n);if(version!==loadVersion)return;size=n;bank=loaded;ready=true;last=performance.now();strip();draw();}
 catch(error){el('error').hidden=false;el('error').textContent=error.message;el('status').value='Không tải được ảnh';}
}
el('run').onclick=()=>select('run');el('attack').onclick=()=>select('attack');el('pause').onclick=()=>{setPaused(!paused);draw();};el('restart').onclick=()=>select(action);
el('background').onchange=()=>{el('stage').dataset.bg=el('background').value;};el('quality').onchange=changeQuality;el('root').onchange=draw;
el('scrub').oninput=()=>{frame=Number(el('scrub').value);elapsed=0;hold=0;setPaused(true);draw();};
document.addEventListener('visibilitychange',()=>{last=performance.now();});
changeQuality();requestAnimationFrame(tick);
