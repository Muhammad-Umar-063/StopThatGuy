// Deterministic original model/rig/clip exporter; runtime uses Babylon's official loader.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {model} from './model.mjs';
import {bones,clips,pose} from './rig.mjs';
export const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function exportCharacter(identity){
 const chunks=[],doc={asset:{version:'2.0',generator:'Stop That Guy! original character authoring v1'},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[{name:`${identity}:cloth-skin`,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.88},doubleSided:false}],skins:[],animations:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[]};
 let bytes=0;
 function accessor(array,type,componentType,target,bounds){const b=Buffer.from(array.buffer,array.byteOffset,array.byteLength),padded=Buffer.alloc(Math.ceil(b.length/4)*4);b.copy(padded);const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:bytes,byteLength:b.length,...(target?{target}:{})});chunks.push(padded);bytes+=padded.length;
 const size={SCALAR:1,VEC3:3,VEC4:4,MAT4:16}[type],a={bufferView:view,componentType,count:array.length/size,type};if(bounds){a.min=Array(size).fill(Infinity);a.max=Array(size).fill(-Infinity);for(let i=0;i<array.length;i++){const k=i%size;a.min[k]=Math.min(a.min[k],array[i]);a.max[k]=Math.max(a.max[k],array[i]);}}
 doc.accessors.push(a);return doc.accessors.length-1;}
 for(const [name,parent,p] of bones){const pp=parent<0?[0,0,0]:bones[parent][2];doc.nodes.push({name,translation:[-p[0]+pp[0],p[1]-pp[1],p[2]-pp[2]],children:[]});}
 for(let i=0;i<bones.length;i++)if(bones[i][1]>=0)doc.nodes[bones[i][1]].children.push(i);
 doc.scenes[0].nodes.push(0);
 const ibm=[];for(const [, ,p] of bones)ibm.push(1,0,0,0,0,1,0,0,0,0,1,0,p[0],-p[1],-p[2],1);
 doc.skins.push({name:'STG humanoid 17',skeleton:0,joints:bones.map((_,i)=>i),inverseBindMatrices:accessor(new Float32Array(ibm),'MAT4',5126)});
 const lods=[];
 for(let lod=0;lod<3;lod++){
 const g=model(identity,lod),mesh=doc.meshes.length;
 const attributes={POSITION:accessor(new Float32Array(g.positions),'VEC3',5126,34962,true),NORMAL:accessor(new Float32Array(g.normals),'VEC3',5126,34962),COLOR_0:accessor(new Float32Array(g.colors),'VEC4',5126,34962),JOINTS_0:accessor(new Uint16Array(g.joints),'VEC4',5123,34962),WEIGHTS_0:accessor(new Float32Array(g.weights),'VEC4',5126,34962)};
 doc.meshes.push({name:`${identity}:LOD${lod}`,primitives:[{attributes,indices:accessor(new Uint16Array(g.indices),'SCALAR',5123,34963),material:0}]});
 doc.scenes[0].nodes.push(doc.nodes.length);doc.nodes.push({name:`${identity}:LOD${lod}`,mesh,skin:0});
 lods.push({level:lod,triangles:g.indices.length/3,vertices:g.positions.length/3,vertexBufferBytes:g.positions.length*4+g.normals.length*4+g.colors.length*4+g.joints.length*2+g.weights.length*4,indexBufferBytes:g.indices.length*2});
 }
 for(const [name,clip] of Object.entries(clips)){
  const count=Math.round(clip.duration*60)+1,times=Array.from({length:count},(_,i)=>i/60),input=accessor(new Float32Array(times),'SCALAR',5126,undefined,true),samples=times.map(t=>pose(name,t/clip.duration));
  const animation={name,samplers:[],channels:[],extras:{strideMetres:clip.stride}};
  function track(node,path,values,type){const sampler=animation.samplers.length;animation.samplers.push({input,output:accessor(new Float32Array(values),type,5126),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node,path}});}
  for(let j=0;j<bones.length;j++)track(j,'rotation',samples.flatMap(p=>p.rotation[j]),'VEC4');
  track(0,'translation',samples.flatMap(p=>p.translation[0]),'VEC3');doc.animations.push(animation);
 }
 doc.buffers[0].byteLength=bytes;
 const json=Buffer.from(JSON.stringify(doc)),jsonPad=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(jsonPad);
 const bin=Buffer.concat(chunks),glb=Buffer.alloc(12+8+jsonPad.length+8+bin.length);glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(jsonPad.length,12);glb.writeUInt32LE(0x4e4f534a,16);jsonPad.copy(glb,20);glb.writeUInt32LE(bin.length,20+jsonPad.length);glb.writeUInt32LE(0x004e4942,24+jsonPad.length);bin.copy(glb,28+jsonPad.length);
 return {glb,doc,lods,sha256:hash(glb)};
}
export function build(check=false){
 const sourceFiles=['mesh.mjs','rig.mjs','model.mjs','export.mjs'],sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(readFileSync(resolve(ROOT,'assets-source/characters',f)))]));
 const manifest={schemaVersion:1,status:'active',description:'Original smooth stylized player and satchel robber; real skinned LODs and five locomotion clips. Final user art approval and hardware performance remain unverified.',assets:[]},report={sourceHashes,characters:{}};
 const write=(p,b)=>{p=resolve(ROOT,p);if(check){if(!readFileSync(p).equals(Buffer.from(b)))throw new Error(`Stale character export: ${p}`);}else{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);}};
 for(const identity of ['player','robber']){const {glb,lods,sha256}=exportCharacter(identity),runtimePath=`assets/characters/${identity}.glb`;
  write(`apps/client/public/${runtimePath}`,glb);report.characters[identity]={sha256,fileSizeBytes:glb.length,lods,bones:bones.length,clips,materials:1,textures:0,textureBytes:0};
  manifest.assets.push({id:`character.${identity}`,kind:'model',runtimePath,source:{path:'assets-source/characters/model.mjs',url:null},creator:'Chat C (Codex), original AI-assisted procedural authoring for Stop That Guy!',origin:'self-authored',license:{id:'LicenseRef-Project-Original',textPath:'assets/licenses/characters/ORIGINAL.txt',url:null},attribution:{required:false,text:null},modifications:'Original ring-surface anatomy/clothing, weighted 17-joint skeleton, analytical foot trajectories exported as real glTF quaternion/translation clips, three independently authored mesh resolutions; X reflection with reversed winding for Babylon glTF conversion. No third-party model/texture or generative media service.',fileSizeBytes:glb.length,generatorTermsCheckedAt:null,technical:{triangles:lods.reduce((n,l)=>n+l.triangles,0),lods:3,materials:1,textureSizes:[],animations:Object.keys(clips)}});
 }
 write('assets/manifest-characters.json',JSON.stringify(manifest,null,2)+'\n');write('assets-source/characters/export-report.json',JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(build(process.argv.includes('--check')),null,2));
