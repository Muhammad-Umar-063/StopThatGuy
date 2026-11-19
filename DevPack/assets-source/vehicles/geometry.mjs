// Original surface authoring. Project LH metres; reflect X only at glTF export.
export const geometry=()=>({positions:[],normals:[],colors:[],indices:[]});
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
function vertex(g,p,n,c){g.positions.push(...p);g.normals.push(...n);g.colors.push(...c,1);}
function quad(g,a,b,c,d){g.indices.push(a,b,c,b,d,c);}
/** Closed cylinder along arbitrary segment, with separate cap normals. */
export function tube(g,a,b,r,color,n=10,rEnd=r){
 const w=unit(sub(b,a)),u=unit(cross(Math.abs(w[1])<.9?[0,1,0]:[1,0,0],w)),v=cross(w,u),start=g.positions.length/3;
 for(let row=0;row<2;row++)for(let i=0;i<n;i++){const t=i/n*Math.PI*2,normal=u.map((x,k)=>x*Math.cos(t)+v[k]*Math.sin(t));vertex(g,(row?b:a).map((x,k)=>x+normal[k]*(row?rEnd:r)),normal,color);}
 for(let i=0;i<n;i++)quad(g,start+i,start+(i+1)%n,start+i+n,start+(i+1)%n+n);
 for(let end=0;end<2;end++){
  const base=g.positions.length/3,normal=w.map(x=>x*(end?1:-1));vertex(g,end?b:a,normal,color);
  for(let i=0;i<n;i++){const t=i/n*Math.PI*2;vertex(g,(end?b:a).map((x,k)=>x+(u[k]*Math.cos(t)+v[k]*Math.sin(t))*(end?rEnd:r)),normal,color);}
  for(let i=0;i<n;i++){const x=base+1+i,y=base+1+(i+1)%n;g.indices.push(...(end?[base,x,y]:[base,y,x]));}
 }
}
/** Ellipsoid with analytical smooth normals and nondegenerate pole triangles. */
export function ellipsoid(g,c,r,color,n=16,m=8){
 const start=g.positions.length/3;
 vertex(g,[c[0],c[1]-r[1],c[2]],[0,-1,0],color);
 for(let row=1;row<m;row++)for(let i=0;i<n;i++){
  const a=-Math.PI/2+row/m*Math.PI,t=i/n*Math.PI*2,p=[Math.cos(a)*Math.cos(t),Math.sin(a),Math.cos(a)*Math.sin(t)];
  vertex(g,p.map((x,k)=>c[k]+x*r[k]),unit(p.map((x,k)=>x/r[k])),color);
 }
 const top=g.positions.length/3;vertex(g,[c[0],c[1]+r[1],c[2]],[0,1,0],color);
 for(let i=0;i<n;i++){g.indices.push(start,start+1+i,start+1+(i+1)%n);g.indices.push(top,top-n+(i+1)%n,top-n+i);}
 for(let row=0;row<m-2;row++)for(let i=0;i<n;i++){const a=start+1+row*n+i,b=start+1+row*n+(i+1)%n;quad(g,a,a+n,b,b+n);}
}
/** Rounded rectangular Y cross-sections, used for sheet-metal bodywork and seats. */
export function body(g,c,rows,color,n=24){
 const start=g.positions.length/3;
 for(const [y,rx,rz,dz=0] of rows)for(let i=0;i<n;i++){
  const t=i/n*Math.PI*2,co=Math.cos(t),si=Math.sin(t);
  // Superellipse exponent 4: broad panels with controlled rounded corners.
  const x=Math.sign(co)*Math.sqrt(Math.abs(co))*Math.max(rx,.0001),z=Math.sign(si)*Math.sqrt(Math.abs(si))*Math.max(rz,.0001);
  vertex(g,[c[0]+x,c[1]+y,c[2]+z+dz],[0,0,0],color);
 }
 for(let row=0;row<rows.length-1;row++)for(let i=0;i<n;i++){const a=start+row*n+i,b=start+row*n+(i+1)%n;quad(g,a,a+n,b,b+n);}
 // Smooth normals within this single original shell; do not merge unrelated surfaces.
 for(let i=0;i<g.indices.length;i+=3){const ids=g.indices.slice(i,i+3);if(ids[0]<start)continue;const [a,b,c]=ids.map(j=>g.positions.slice(j*3,j*3+3)),normal=cross(sub(b,a),sub(c,a));for(const j of ids)for(let k=0;k<3;k++)g.normals[j*3+k]+=normal[k];}
 for(let i=start;i<g.positions.length/3;i++){const no=unit(g.normals.slice(i*3,i*3+3));g.normals.splice(i*3,3,...no);}
}
/** Torus around X: wheel plane is Y/Z. */
export function torus(g,c,r,minor,width,color,n=32,m=8){
 const start=g.positions.length/3;
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){
  const a=i/n*Math.PI*2,b=j/m*Math.PI*2,rad=r+minor*Math.cos(b),normal=unit([Math.sin(b)/width,Math.cos(b)*Math.cos(a)/minor,Math.cos(b)*Math.sin(a)/minor]);
  vertex(g,[c[0]+width*Math.sin(b),c[1]+rad*Math.cos(a),c[2]+rad*Math.sin(a)],normal,color);
 }
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){const a=start+i*m+j,b=start+((i+1)%n)*m+j,c=start+i*m+(j+1)%m,d=start+((i+1)%n)*m+(j+1)%m;quad(g,a,b,c,d);}
}
export function offset(g,p){for(let i=0;i<g.positions.length;i++)g.positions[i]-=p[i%3];return g;}
export function finish(g){
 for(let i=0;i<g.positions.length;i+=3){g.positions[i]*=-1;g.normals[i]*=-1;}
 for(let i=0;i<g.indices.length;i+=3)[g.indices[i+1],g.indices[i+2]]=[g.indices[i+2],g.indices[i+1]];
 return g;
}
