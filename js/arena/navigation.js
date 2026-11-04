import {WORLD} from './terrain.js';
import {WALLS} from './data.js';
const STEP=2;
const blocked=(x,z)=>WALLS.some(w=>Math.abs(x-w.x)<w.w/2+.65&&Math.abs(z-w.z)<w.d/2+.65);
export function findPath(start,target){
  if(![start.x,start.z,target.x,target.z].every(Number.isFinite))return [];
  const nx=WORLD.halfX, nz=WORLD.halfZ, width=nx+1;
  const cell=p=>[Math.round((Math.max(-nx,Math.min(nx,p.x))+nx)/STEP),Math.round((Math.max(-nz,Math.min(nz,p.z))+nz)/STEP)];
  const point=(x,z)=>({x:x*STEP-nx,z:z*STEP-nz});
  const [sx,sz]=cell(start);let [gx,gz]=cell(target);
  gx=Math.max(1,Math.min(nx-1,gx));gz=Math.max(1,Math.min(nz-1,gz));
  if(blocked(point(gx,gz).x,point(gx,gz).z)){let found=false;for(let r=1;r<5&&!found;r++)for(let dx=-r;dx<=r&&!found;dx++)for(let dz=-r;dz<=r&&!found;dz++){const q=point(gx+dx,gz+dz);if(!blocked(q.x,q.z)&&Math.abs(q.x)<nx&&Math.abs(q.z)<nz){gx+=dx;gz+=dz;found=true;}}if(!found)return [];}
  const key=(x,z)=>z*width+x,initial=key(sx,sz),goal=key(gx,gz),open=[{x:sx,z:sz,g:0,f:0}],cost=new Map([[initial,0]]),parent=new Map();
  let iterations=0;
  while(open.length&&iterations++<12000){open.sort((a,b)=>b.f-a.f);const cur=open.pop(),id=key(cur.x,cur.z);if(cur.g!==cost.get(id))continue;
    if(id===goal){const result=[];let k=id;while(k!==initial){result.push(point(k%width,Math.floor(k/width)));k=parent.get(k);if(k===undefined)return [];}return result.reverse();}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const x=cur.x+dx,z=cur.z+dz,q=point(x,z);if(x<0||x>nx||z<0||z>nz||blocked(q.x,q.z))continue;
      if(dx&&dz&&(blocked(point(cur.x+dx,cur.z).x,point(cur.x+dx,cur.z).z)||blocked(point(cur.x,cur.z+dz).x,point(cur.x,cur.z+dz).z)))continue;
      const next=key(x,z),g=cur.g+Math.hypot(dx,dz);if(g>=(cost.get(next)??Infinity))continue;cost.set(next,g);parent.set(next,id);open.push({x,z,g,f:g+Math.hypot(gx-x,gz-z)});
    }
  }return [];
}
