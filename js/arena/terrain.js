// Shared CPU height field. Both the visible mesh and walking use these samples.
export const WORLD={halfX:80,halfZ:60};
export const riverZ=x=>9*Math.sin(x*.045)+3*Math.sin(x*.09);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function terrainHeight(x,z){
  const hill=(cx,cz,h,r)=>h*Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
  let y=1.3+.7*Math.sin(x*.075)*Math.cos(z*.09)+hill(-35,-32,10,19)+hill(31,31,13,22)+hill(49,-36,8,15)+hill(-48,34,7,16);
  const river=Math.abs(z-riverZ(x));y=-.9+(y+.9)*smooth((river-2.5)/5);
  for(const bx of [-65,65]){const blend=smooth((Math.hypot(x-bx,z)-7)/6);y=1+(y-1)*blend;}
  return y;
}
export function groundHeight(x,z){
  // Two solid walkable wooden bridges; the water below remains a separate mesh.
  if([-25,25].some(bx=>Math.abs(x-bx)<2.2)&&Math.abs(z-riverZ(x))<7)return .65;
  return terrainHeight(x,z);
}
export const inWater=(x,z)=>terrainHeight(x,z)<-.25&&groundHeight(x,z)<0;
