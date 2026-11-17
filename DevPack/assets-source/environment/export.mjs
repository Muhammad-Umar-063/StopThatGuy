// Source -> runtime export, deterministic and dependency-free. Run from DevPack.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parts,part,box,rod,arch,extrude } from './geometry.mjs';
import { texture } from './textures.mjs';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const MATERIALS={
  stone:{color:[1,1,1,1],texture:'stone'}, plaster:{color:[1,1,1,1],texture:'plaster'},
  paving:{color:[1,1,1,1],texture:'paving'}, tile:{color:[1,1,1,1],texture:'tile'},
  roof:{color:[1,1,1,1],texture:'roof'}, asphalt:{color:[1,1,1,1],texture:'asphalt'},
  glass:{color:[.055,.14,.17,1],metal:.2,rough:.22}, metal:{color:[.055,.10,.12,1],metal:.7,rough:.42},
  shutter:{color:[.12,.30,.29,1]}, wood:{color:[.22,.12,.07,1]}, brass:{color:[.48,.32,.12,1],metal:.7,rough:.35},
  leaf:{color:[.19,.32,.12,1]}, flower:{color:[.77,.22,.32,1]}, lantern:{color:[1,.83,.5,1]}
};
export function makeKit(){
  parts.clear();
  // 1.5 m tall-front windows with chamfered stone reveals, opaque recessed glazing,
  // mullions and shutter slats. All profiles face project +Z, origin at sill centre.
  part('window','stone');
  box(0,.06,0,1.7,.13,.38,.04);box(-.73,1.1,-.05,.15,2.15,.22,.025);box(.73,1.1,-.05,.15,2.15,.22,.025);box(0,2.18,-.04,1.65,.16,.26,.03);
  part('window','glass');box(0,1.13,-.14,1.32,1.95,.05,.04);
  part('window','wood');box(0,1.13,-.08,.055,1.95,.06);box(0,1.20,-.07,1.31,.055,.06);
  part('window','shutter');for(const side of [-1,1]){box(side*.57,1.13,.02,.25,1.95,.09,.025);for(let j=0;j<13;j++)box(side*.57,.28+j*.135,.085,.23,.045,.03);}
  // Arched ground-floor portals, warm limestone and glazed double doors.
  part('portal','stone');box(-1,1.2,0,.22,2.4,.35,.04);box(1,1.2,0,.22,2.4,.35,.04);arch(0,2.4,1.11,.89,-.17,.18);box(0,.04,.1,2.35,.08,.65,.02);
  part('portal','wood');box(-.46,1.13,-.13,.88,2.25,.1,.02);box(.46,1.13,-.13,.88,2.25,.1,.02);
  const cap=[[0,2.4]];for(let i=0;i<=24;i++)cap.push([.88*Math.cos(i*Math.PI/24),2.4+.88*Math.sin(i*Math.PI/24)]);extrude(cap,-.19,-.12);
  part('portal','glass');box(-.46,1.5,-.065,.65,1.25,.02);box(.46,1.5,-.065,.65,1.25,.02);
  part('portal','brass');rod([-.08,.9,.01],[-.08,1.3,.01],.024);rod([.08,.9,.01],[.08,1.3,.01],.024);
  part('balcony','stone');box(0,0,.4,1.9,.15,1,.045);
  part('balcony','metal');for(const x of [-.9,.9])rod([x,.1,0],[x,.92,.85],.024);
  rod([-.92,.93,.87],[.92,.93,.87],.035,16);rod([-.92,.16,.87],[.92,.16,.87],.022);
  for(let i=0;i<=10;i++){const x=-.9+i*.18;rod([x,.16,.87],[x,.93,.87],.014,8);}
  part('balcony-detail','metal');for(let i=0;i<5;i++){const cx=-.72+i*.36;for(let j=0;j<16;j++){const a=j*Math.PI*2/16,b=(j+1)*Math.PI*2/16;rod([cx+.14*Math.cos(a),.54+.24*Math.sin(a),.87],[cx+.14*Math.cos(b),.54+.24*Math.sin(b),.87],.011,6);}}
  part('cornice','stone');box(0,0,0,1,.14,.26,.025);box(0,.12,.035,1,.10,.36,.02);box(0,.20,.07,1,.08,.43,.015);
  part('rack','metal');rod([-.42,0,0],[-.42,.65,0],.035,16);rod([.42,0,0],[.42,.65,0],.035,16);
  for(let i=0;i<16;i++){const a=i*Math.PI/16,b=(i+1)*Math.PI/16;rod([.42*Math.cos(a),.65+.42*Math.sin(a),0],[.42*Math.cos(b),.65+.42*Math.sin(b),0],.035,12);}
  part('lamp','metal');rod([0,0,0],[0,3.6,0],.07,20);rod([0,.0,0],[0,.25,0],.13,20);
  for(let i=0;i<12;i++){const a=i*Math.PI/24,b=(i+1)*Math.PI/24;rod([0,3.6+.45*Math.sin(a),.45*(1-Math.cos(a))],[0,3.6+.45*Math.sin(b),.45*(1-Math.cos(b))],.045,12);}
  box(0,3.55,.45,.45,.64,.45,.04);box(0,3.90,.45,.64,.08,.64,.035);box(0,3.20,.45,.5,.06,.5,.025);
  part('lamp','lantern');box(0,3.55,.45,.33,.53,.47,.02);box(0,3.55,.45,.47,.53,.33,.02);
  part('flowerbox','roof');box(0,.05,.12,1.0,.22,.32,.045);
  part('flowerbox','leaf');for(let i=0;i<14;i++){const x=-.43+i*.066;rod([x,.15,.12],[x+.07*Math.sin(i),.35+(i%3)*.05,.1],.045,8);}
  part('flowerbox','flower');for(let i=0;i<9;i++)box(-.4+i*.1,.37+(i%2)*.08,.12,.075,.065,.075,.025);
  // Materials for world-aligned street surfaces, intentionally hidden at runtime.
  for(const name of Object.keys(MATERIALS)){part('swatch',name);box(0,0,0,.01,.01,.01);}
  const blobs=[],views=[],accessors=[];let offset=0;
  const view=(buf,target)=>{const i=views.length;views.push({buffer:0,byteOffset:offset,byteLength:buf.length,...(target?{target}:{})});blobs.push(buf,Buffer.alloc((4-buf.length%4)%4));offset+=Math.ceil(buf.length/4)*4;return i;};
  const acc=(data,type,isPosition=false)=>{const width=type==='VEC3'?3:type==='VEC2'?2:1;const buf=Buffer.alloc(data.length*(width===1?2:4));data.forEach((v,i)=>width===1?buf.writeUInt16LE(v,i*2):buf.writeFloatLE(v,i*4));
    const index=accessors.length;accessors.push({bufferView:view(buf,width===1?34963:34962),componentType:width===1?5123:5126,count:data.length/width,type,
      ...(isPosition?{min:[0,1,2].map(a=>Math.min(...data.filter((_,i)=>i%3===a))),max:[0,1,2].map(a=>Math.max(...data.filter((_,i)=>i%3===a)))}:{})});return index;};
  const names=Object.keys(MATERIALS),images=[],textures=[];
  const materials=names.map(name=>{const m=MATERIALS[name];let baseColorTexture;
    if(m.texture){const size=m.texture==='paving'?512:256;const png=texture(m.texture,size);baseColorTexture={index:textures.length};images.push({name:m.texture,bufferView:view(png),mimeType:'image/png'});textures.push({source:images.length-1,sampler:0});}
    return{name:`kit/${name}`,pbrMetallicRoughness:{baseColorFactor:m.color,metallicFactor:m.metal??0,roughnessFactor:m.rough??.86,...(baseColorTexture?{baseColorTexture}:{})}};
  });
  const meshes=[...parts.values()].map(g=>({name:g.name,primitives:[{attributes:{POSITION:acc(g.p,'VEC3',true),NORMAL:acc(g.n,'VEC3'),TEXCOORD_0:acc(g.uv,'VEC2')},indices:acc(g.i,'SCALAR'),material:names.indexOf(g.material),mode:4}]}));
  const gltf={asset:{version:'2.0',generator:'Stop That Guy! original Lisbon architectural kit v1',copyright:'Original project art; assets-source/environment/LICENSE.txt'},scene:0,scenes:[{nodes:meshes.map((_,i)=>i)}],nodes:meshes.map((m,i)=>({name:m.name,mesh:i})),meshes,materials,images,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],buffers:[{byteLength:offset}],bufferViews:views,accessors};
  const json=Buffer.from(JSON.stringify(gltf));const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(blobs);const header=Buffer.alloc(20),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);
  const glb=Buffer.concat([header,padded,bh,bin]);
  return {glb,sha256:createHash('sha256').update(glb).digest('hex'),technical:{triangles:[...parts.values()].reduce((n,p)=>n+p.i.length/3,0),lods:1,materials:names.length,textureSizes:['256x256','256x256','512x512','256x256','256x256','256x256'],animations:[]},parts:[...parts.values()].map(p=>({name:p.name,triangles:p.i.length/3}))};
}
export function exportKit(check=false){const r=makeKit();const path=resolve(ROOT,'apps/client/public/assets/environment/lisbon-kit.glb');const mp=resolve(ROOT,'assets/manifest-environment.json');
  const manifest={schemaVersion:1,status:'active',description:'Original final-direction Lisbon architectural kit. Not final city, characters or visual acceptance.',assets:[{id:'environment.lisbon-kit',kind:'model',runtimePath:'assets/environment/lisbon-kit.glb',source:{path:'assets-source/environment/export.mjs',url:null},creator:'Chat C (Codex), original AI-assisted procedural art for Stop That Guy!',origin:'self-authored',license:{id:'LicenseRef-Project-Original',textPath:'assets-source/environment/LICENSE.txt',url:null},attribution:{required:false,text:null},modifications:'Original geometry/pixel patterns; metres, X reflection and reversed winding for glTF. Reused via thin instances. No external textures, models or generative-media service.',fileSizeBytes:r.glb.length,generatorTermsCheckedAt:null,technical:r.technical}]};
  const text=JSON.stringify(manifest,null,2)+'\n';
  if(check){if(!readFileSync(path).equals(r.glb)||readFileSync(mp,'utf8')!==text)throw new Error('Stale environment export/manifest');}
  else{mkdirSync(dirname(path),{recursive:true});writeFileSync(path,r.glb);writeFileSync(mp,text);}
  return r;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=exportKit(process.argv.includes('--check'));console.log(JSON.stringify({bytes:r.glb.length,sha256:r.sha256,...r.technical,parts:r.parts},null,2));}
