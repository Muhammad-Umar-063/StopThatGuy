import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {definitions} from './definition.mjs';
import {model} from './model.mjs';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function exportVehicle(type){
 const def=definitions[type],chunks=[],nodes=new Map(),doc={asset:{version:'2.0',generator:'Stop That Guy! original transport authoring v1'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:`${type}:visual`,children:[]}],meshes:[],materials:[{name:`${type}:paint-metal-rubber`,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:.18,roughnessFactor:.65}}],buffers:[{byteLength:0}],bufferViews:[],accessors:[]};let bytes=0;
 function accessor(a,type,target,bounds=false){const data=Buffer.from(a.buffer,a.byteOffset,a.byteLength),pad=Buffer.alloc(Math.ceil(data.length/4)*4);data.copy(pad);const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:data.length,...(target?{target}:{})});chunks.push(pad);bytes+=pad.length;const size={SCALAR:1,VEC3:3,VEC4:4}[type],acc={bufferView:view,componentType:a instanceof Uint16Array?5123:5126,count:a.length/size,type};if(bounds){acc.min=Array(size).fill(Infinity);acc.max=Array(size).fill(-Infinity);a.forEach((x,i)=>{acc.min[i%size]=Math.min(acc.min[i%size],x);acc.max[i%size]=Math.max(acc.max[i%size],x);});}doc.accessors.push(acc);return doc.accessors.length-1;}
 function node(name,parent,position=[0,0,0],mesh){const index=doc.nodes.length;nodes.set(name,index);doc.nodes.push({name,translation:[-position[0],position[1],position[2]],children:[],...(mesh===undefined?{}:{mesh})});doc.nodes[parent?nodes.get(parent):0].children.push(index);return index;}
 for(const [name,p] of Object.entries(def.pivots))node(name,p.parent,p.position);
 for(const [name,a] of Object.entries(def.anchors))node(`anchor.${name}`,a.parent,a.position);
 const lods=[];
 for(let lod=0;lod<3;lod++){
  let triangles=0,vertices=0,bufferBytes=0,parts=0;
  for(const p of model(type,lod)){
   const g=p.geometry,attributes={POSITION:accessor(new Float32Array(g.positions),'VEC3',34962,true),NORMAL:accessor(new Float32Array(g.normals),'VEC3',34962),COLOR_0:accessor(new Float32Array(g.colors),'VEC4',34962)};
   const name=`${type}:${p.name}:LOD${lod}`,mesh=doc.meshes.length;
   doc.meshes.push({name,primitives:[{attributes,indices:accessor(new Uint16Array(g.indices),'SCALAR',34963),material:0}]});node(name,p.parent,undefined,mesh);
   triangles+=g.indices.length/3;vertices+=g.positions.length/3;bufferBytes+=(g.positions.length+g.normals.length+g.colors.length)*4+g.indices.length*2;parts++;
  }
  lods.push({level:lod,triangles,vertices,bufferBytes,meshes:parts});
 }
 doc.buffers[0].byteLength=bytes;const json=Buffer.from(JSON.stringify(doc)),pad=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(pad);const bin=Buffer.concat(chunks),glb=Buffer.alloc(28+pad.length+bin.length);
 glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(pad.length,12);glb.writeUInt32LE(0x4e4f534a,16);pad.copy(glb,20);glb.writeUInt32LE(bin.length,20+pad.length);glb.writeUInt32LE(0x004e4942,24+pad.length);bin.copy(glb,28+pad.length);
 return {glb,doc,lods,sha256:hash(glb)};
}
export function build(check=false){
 const report={sourceHashes:Object.fromEntries(['geometry.mjs','definition.mjs','model.mjs','export.mjs'].map(n=>[n,hash(readFileSync(resolve(ROOT,'assets-source/vehicles',n)))])),vehicles:{}},manifest={schemaVersion:1,status:'active',description:'Original smooth transport art with stable pivots/fit anchors; presentation only. User art approval and device performance remain unverified.',assets:[]};
 const write=(p,b)=>{p=resolve(ROOT,p);if(check){if(!readFileSync(p).equals(Buffer.from(b)))throw new Error(`Stale vehicle output: ${p}`);}else{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);}};
 for(const [type,def] of Object.entries(definitions)){
  const r=exportVehicle(type),runtimePath=`assets/vehicles/${type}.glb`;write(`apps/client/public/${runtimePath}`,r.glb);
  report.vehicles[type]={sha256:r.sha256,fileSizeBytes:r.glb.length,lods:r.lods,materials:1,textures:0,pivots:Object.keys(def.pivots),anchors:Object.keys(def.anchors)};
  manifest.assets.push({id:def.id,kind:'model',runtimePath,source:{path:'assets-source/vehicles/model.mjs',url:null},creator:'Chat C (Codex), original AI-assisted procedural authoring for Stop That Guy!',origin:'self-authored',license:{id:'LicenseRef-Project-Original',textPath:'assets/licenses/vehicles/ORIGINAL.txt',url:null},attribution:{required:false,text:null},modifications:'Original tube, torus, rounded body profiles and vertex palette; three mesh resolutions, named wheel/steering/crank pivots and seat/hand/foot nodes; X-reflected glTF export with reversed winding. No third-party media.',fileSizeBytes:r.glb.length,generatorTermsCheckedAt:null,technical:{triangles:r.lods.reduce((s,l)=>s+l.triangles,0),lods:3,materials:1,textureSizes:[],animations:[]}});
 }
 write('assets/manifest-vehicles.json',JSON.stringify(manifest,null,2)+'\n');write('assets-source/vehicles/export-report.json',JSON.stringify(report,null,2)+'\n');write('apps/client/src/render/vehicles/definitions.generated.json',JSON.stringify(definitions,null,2)+'\n');return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const r=build(process.argv.includes('--check'));console.log(Object.entries(r.vehicles).map(([type,v])=>`${type}: ${v.fileSizeBytes} bytes; triangles ${v.lods.map(l=>l.triangles).join('/')}`).join('\n'));}
