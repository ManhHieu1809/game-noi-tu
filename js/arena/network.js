import { getPeerOptions, generateCode, cleanCode } from '../net.js';
const PREFIX='arena-v1-';
const send=(c,m)=>{try{if(c?.open)c.send(m);}catch{}};
export class ArenaRoom {
  constructor(callbacks){this.cb=callbacks;this.members=[];this.connections=new Map();this.closed=false;this.host=false;this.seq=0;this.last=0;this.pending=new Set();}
  async open(name,code){
    if(!window.Peer)throw Error('Không tải được PeerJS. Kiểm tra mạng và tải lại.');
    this.host=!code;this.code=code?cleanCode(code):generateCode();
    if(this.code.length!==5)throw Error('Mã phòng cần 5 ký tự.');
    this.peer=this.host?new window.Peer(PREFIX+this.code,getPeerOptions()):new window.Peer(getPeerOptions());
    const errorText=e=>e.type==='peer-unavailable'?'Không tìm thấy phòng chiến đấu.':e.type==='unavailable-id'?'Mã phòng bị trùng, hãy tạo lại.':'Kết nối thất bại. Kiểm tra mạng hoặc thử lại.';
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Hết thời gian kết nối phòng.')),15000);
      this.peer.on('error',e=>{clearTimeout(timer);if(!this.ready)reject(Error(errorText(e)));else this.close(errorText(e));});
      this.peer.on('open',id=>{this.id=id;if(this.host){this.members=[{id,name,team:0,role:'fighter'}];this.ready=true;clearTimeout(timer);resolve();this.publishLobby();}
        else {this.conn=this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json'});this.conn.on('open',()=>send(this.conn,{t:'join',name}));
          this.conn.on('data',m=>{if(!m||typeof m!=='object')return;
            if(m.t==='lobby'){this.members=m.members;this.cb.lobby?.(m.members);if(!this.ready){this.ready=true;clearTimeout(timer);resolve();}}
            if(m.t==='state'&&Number.isSafeInteger(m.seq)&&m.seq>this.seq){this.seq=m.seq;this.cb.state?.(m.state);}
            if(m.t==='notice')this.cb.notice?.(String(m.text).slice(0,200));
            if(m.t==='closed'){clearTimeout(timer);reject(Error(m.reason));this.close(m.reason);}
          });this.conn.on('close',()=>{clearTimeout(timer);reject(Error('Chủ phòng đã đóng hoặc mất kết nối.'));this.close('Chủ phòng đã đóng hoặc mất kết nối.');});}
      });
    }).catch(e=>{this.close();throw e;});
    if(this.host)this.peer.on('connection',c=>this.accept(c));return this;
  }
  accept(c){
    this.pending.add(c);let admitted=false,lastAction=0;const timer=setTimeout(()=>c.close(),8000);
    c.on('data',m=>{if(!m||typeof m!=='object')return;
      if(m.t==='join'&&!admitted){
        if(this.playing||this.members.length>=4||this.members.some(p=>p.id===c.peer)){
          send(c,{t:'closed',reason:this.playing?'Trận đã bắt đầu.':'Phòng đã đủ 4 người.'});setTimeout(()=>c.close(),200);return;}
        clearTimeout(timer);admitted=true;this.pending.delete(c);this.connections.set(c.peer,c);
        const team=this.members.filter(p=>p.team===0).length<2?0:1;
        this.members.push({id:c.peer,name:String(m.name??'Bạn').replace(/[\u0000-\u001f]/g,'').slice(0,18),team,role:'fighter'});this.publishLobby();
      }
      if(!admitted)return;
      if(m.t==='pick'&&!this.playing)this.pick(c.peer,m.role,m.team);
      if(m.t==='input'&&this.playing)this.cb.input?.(c.peer,m.input);
      if(m.t==='action'&&this.playing&&performance.now()-lastAction>70){lastAction=performance.now();this.cb.action?.(c.peer,m.action);}
    });
    c.on('close',()=>{clearTimeout(timer);this.pending.delete(c);if(!admitted)return;this.connections.delete(c.peer);this.members=this.members.filter(p=>p.id!==c.peer);if(this.playing)this.close('Một người đã mất kết nối. Trận dừng và không ghi nhận thắng/thua.');else this.publishLobby();});
    c.on('error',()=>c.close());
  }
  pick(id,role,team){
    if(!['fighter','tank','mage','ranger'].includes(role)||![0,1].includes(team))return;
    const p=this.members.find(p=>p.id===id);if(!p)return;
    if(this.members.filter(p=>p.id!==id&&p.team===team).length>=2)return;
    p.role=role;p.team=team;this.publishLobby();
  }
  select(role,team){if(this.host)this.pick(this.id,role,team);else send(this.conn,{t:'pick',role,team});}
  publishLobby(){for(const c of this.connections.values())send(c,{t:'lobby',members:this.members});this.cb.lobby?.(this.members);}
  input(input){if(this.host)this.cb.input?.(this.id,input);else send(this.conn,{t:'input',input});}
  action(action){if(this.host)this.cb.action?.(this.id,action);else send(this.conn,{t:'action',action});}
  notice(id,text){if(id===this.id)this.cb.notice?.(text);else send(this.connections.get(id),{t:'notice',text});}
  broadcast(state,now){if(now-this.last<80)return;this.last=now;for(const c of this.connections.values())send(c,{t:'state',seq:++this.seq,state});}
  close(reason){if(this.closed)return;this.closed=true;for(const c of this.connections.values()){send(c,{t:'closed',reason:reason||'Chủ phòng đã đóng phòng.'});setTimeout(()=>c.close(),100);}for(const c of this.pending)c.close();this.connections.clear();setTimeout(()=>this.peer?.destroy(),150);if(reason)this.cb.closed?.(reason);}
}
