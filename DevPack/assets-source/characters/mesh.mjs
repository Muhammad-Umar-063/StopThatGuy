// Original smooth ring surfaces. Authoring space is project LH, metres, +Z forward.
export const mix=(a,b,t)=>a+(b-a)*t;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function geometry(){return {positions:[],normals:[],colors:[],joints:[],weights:[],indices:[]};}
export function rings(g,rows,segments,color,weight){
  const start=g.positions.length/3;
  for(let i=0;i<rows.length;i++)for(let j=0;j<segments;j++){
    const [x,y,z,rx,rz]=rows[i],a=j/segments*Math.PI*2;
    const p=[x+rx*Math.cos(a),y,z+rz*Math.sin(a)],w=weight(p);
    g.positions.push(...p);g.normals.push(0,0,0);g.colors.push(...color,1);
    g.joints.push(w[0],w[1]??w[0],0,0);g.weights.push(1-(w[2]??0),w[2]??0,0,0);
  }
  for(let i=0;i<rows.length-1;i++)for(let j=0;j<segments;j++){
    const a=start+i*segments+j,b=start+i*segments+(j+1)%segments,c=a+segments,d=b+segments;
    g.indices.push(a,c,b,b,c,d);
  }
}
export function loft(g,profile,segments,subdivisions,color,weight){
  const rows=[];
  for(let i=0;i<profile.length-1;i++)for(let s=0;s<subdivisions;s++){
    const t=s/subdivisions,p0=profile[Math.max(0,i-1)],p1=profile[i],p2=profile[i+1],p3=profile[Math.min(profile.length-1,i+2)];
    rows.push(p1.map((v,k)=>k===1?mix(v,p2[k],t):.5*((2*v)+(-p0[k]+p2[k])*t+(2*p0[k]-5*v+4*p2[k]-p3[k])*t*t+(-p0[k]+3*v-3*p2[k]+p3[k])*t*t*t)));
  }
  rows.push(profile.at(-1));rings(g,rows,segments,color,weight);
}
export function ellipsoid(g,c,r,segments,steps,color,weight){
  const rows=[];
  for(let i=0;i<=steps;i++){const a=-Math.PI/2+i/steps*Math.PI;rows.push([c[0],c[1]+Math.sin(a)*r[1],c[2],Math.max(.0001,Math.cos(a)*r[0]),Math.max(.0001,Math.cos(a)*r[2])]);}
  rings(g,rows,segments,color,weight);
}
export function finish(g){
  // Shared vertices produce smooth normals; reflection and winding are applied at export.
  for(let i=0;i<g.indices.length;i+=3){const ids=g.indices.slice(i,i+3).map(x=>x*3),[a,b,c]=ids;
    const u=[0,1,2].map(k=>g.positions[b+k]-g.positions[a+k]),v=[0,1,2].map(k=>g.positions[c+k]-g.positions[a+k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const id of ids)for(let k=0;k<3;k++)g.normals[id+k]+=n[k];
  }
  for(let i=0;i<g.normals.length;i+=3){const len=Math.hypot(...g.normals.slice(i,i+3));if(len<1e-12)throw new Error('Degenerate normal');for(let k=0;k<3;k++)g.normals[i+k]/=len;g.positions[i]*=-1;g.normals[i]*=-1;}
  for(let i=0;i<g.indices.length;i+=3)[g.indices[i+1],g.indices[i+2]]=[g.indices[i+2],g.indices[i+1]];
  return g;
}
