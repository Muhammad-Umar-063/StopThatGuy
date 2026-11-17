// Original metre-scale architectural primitives; export only, no GLB parser.
export const parts = new Map();
let current;
export function part(name, material) {
  const key = `${name}/${material}`;
  if (!parts.has(key)) parts.set(key, { name: key, material, p: [], n: [], uv: [], i: [] });
  current = parts.get(key);
}
export function triangle(a, b, c, normals, uv = [[0, 0], [1, 0], [1, 1]]) {
  const u = b.map((v, i) => v - a[i]); const v = c.map((v, i) => v - a[i]);
  const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
  const l = Math.hypot(...n); if (l < 1e-9) return;
  const start = current.p.length / 3;
  [a, b, c].forEach((p, i) => {
    const normal = normals?.[i] ?? n.map((x) => x/l);
    current.p.push(-p[0], p[1], p[2]); current.n.push(-normal[0], normal[1], normal[2]);
    current.uv.push(...uv[i]);
  });
  current.i.push(start, start + 2, start + 1); // X reflection, reversed winding
}
export function quad(a,b,c,d) { triangle(a,b,c); triangle(a,c,d,undefined,[[0,0],[1,1],[0,1]]); }
export function extrude(outline, z0, z1) {
  const at=(i,z)=>[outline[i][0],outline[i][1],z];
  for(let i=1;i<outline.length-1;i++) {
    triangle(at(0,z1),at(i,z1),at(i+1,z1)); triangle(at(0,z0),at(i+1,z0),at(i,z0));
  }
  for(let i=0;i<outline.length;i++) {const j=(i+1)%outline.length; quad(at(i,z0),at(j,z0),at(j,z1),at(i,z1));}
}
export function box(x,y,z,w,h,d,bevel=0) {
  const a=x-w/2,b=x+w/2,c=y-h/2,e=y+h/2,r=Math.min(bevel,w/3,h/3);
  const outline=r>0?[[a+r,c],[b-r,c],[b,c+r],[b,e-r],[b-r,e],[a+r,e],[a,e-r],[a,c+r]]:[[a,c],[b,c],[b,e],[a,e]];
  extrude(outline,z-d/2,z+d/2);
}
export function rod(a,b,r,segments=12) {
  const axis=b.map((v,i)=>v-a[i]); const len=Math.hypot(...axis); const u=axis.map(v=>v/len);
  const ref=Math.abs(u[1])<.9?[0,1,0]:[1,0,0];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const xx=cross(ref,u); const xl=Math.hypot(...xx); const x=xx.map(v=>v/xl); const z=cross(u,x);
  const normal=t=>x.map((v,i)=>v*Math.cos(t)+z[i]*Math.sin(t));
  const point=(p,n)=>p.map((v,i)=>v+r*n[i]);
  for(let i=0;i<segments;i++) {
    const n=normal(i*2*Math.PI/segments),m=normal((i+1)*2*Math.PI/segments);
    const an=point(a,n),am=point(a,m),bn=point(b,n),bm=point(b,m);
    triangle(an,am,bn,[n,m,n]); triangle(am,bm,bn,[m,m,n]);
    triangle(a,am,an); triangle(b,bn,bm);
  }
}
export function arch(cx,cy,outer,inner,z0,z1,segments=24) {
  for(let i=0;i<segments;i++) {
    const a=i*Math.PI/segments,b=(i+1)*Math.PI/segments;
    extrude([[cx+inner*Math.cos(a),cy+inner*Math.sin(a)],[cx+outer*Math.cos(a),cy+outer*Math.sin(a)],
      [cx+outer*Math.cos(b),cy+outer*Math.sin(b)],[cx+inner*Math.cos(b),cy+inner*Math.sin(b)]],z0,z1);
  }
}
