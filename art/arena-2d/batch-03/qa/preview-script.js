
'use strict';
const definitions={
 run:{name:'Chạy · SE',prefix:'run',count:8,ticks:[5,5,5,5,5,5,5,5],loop:true},
 attack:{name:'Đánh · SE',prefix:'attack',count:6,ticks:[6,7,5,3,5,8],loop:false}
};
const el=id=>document.getElementById(id), canvas=el('player'), ctx=canvas.getContext('2d');
let action='run',frame=0,elapsed=0,paused=false,ready=false,last=performance.now(),images={};
function renderStrip(){
 const d=definitions[action];el('filmstrip').replaceChildren();el('scrub').max=d.count-1;
 for(let i=0;i<d.count;i++){
  const button=document.createElement('button'),image=document.createElement('img'),label=document.createElement('span');
  image.src=images[action][i].src;image.alt=`${d.name}, frame ${i+1}`;label.textContent=`${i+1}${action==='attack'&&i===3?' · chém / hit':''}`;
  button.append(image,label);button.addEventListener('click',()=>{frame=i;elapsed=0;setPaused(true);draw();});el('filmstrip').append(button);
 }
}
function setPaused(value){paused=value;el('pause').textContent=paused?'Tiếp tục':'Tạm dừng';}
function select(next){action=next;frame=0;elapsed=0;setPaused(false);for(const key of Object.keys(definitions))el(key).setAttribute('aria-pressed',String(key===next));renderStrip();draw();}
function draw(){
 if(!ready)return;
 ctx.clearRect(0,0,480,340);ctx.imageSmoothingEnabled=true;
 // Display only: draw finished generated PNG at the common world root, no procedural character art.
 ctx.drawImage(images[action][frame],240-192,300-365);
 if(el('root').checked){ctx.strokeStyle='#fff3a0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(230,300);ctx.lineTo(250,300);ctx.moveTo(240,290);ctx.lineTo(240,310);ctx.stroke();}
 el('status').value=`${definitions[action].name} · ${frame+1}/${definitions[action].count}${paused?' · dừng':''}`;
 el('scrub').value=frame;
 [...el('filmstrip').children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===frame)));
}
function tick(now){
 const dt=Math.min(100,Math.max(0,now-last));last=now;
 if(ready&&!paused&&!document.hidden){
  elapsed+=dt*Number(el('speed').value);const d=definitions[action];
  while(elapsed>=d.ticks[frame]*1000/60){elapsed-=d.ticks[frame]*1000/60;if(frame+1<d.count)frame++;else if(d.loop)frame=0;else{setPaused(true);elapsed=0;break;}}
  draw();
 }
 requestAnimationFrame(tick);
}
el('run').onclick=()=>ready&&select('run');el('attack').onclick=()=>ready&&select('attack');
el('restart').onclick=()=>ready&&select(action);el('pause').onclick=()=>setPaused(!paused);
el('scrub').oninput=()=>{frame=Number(el('scrub').value);elapsed=0;setPaused(true);draw();};
el('background').onchange=()=>el('stage').dataset.bg=el('background').value;el('root').onchange=draw;
document.addEventListener('visibilitychange',()=>{last=performance.now();});
Promise.all(Object.entries(definitions).map(async([key,d])=>{
 images[key]=await Promise.all(Array.from({length:d.count},(_,i)=>new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Không tải được ${key} frame ${i+1}`));image.src=`final/${key}-se/${d.prefix}-${i+1}.png`;
 })));
})).then(()=>{ready=true;renderStrip();draw();}).catch(error=>{el('error').hidden=false;el('error').textContent=error.message;el('status').value='Không tải được asset';});
requestAnimationFrame(tick);
