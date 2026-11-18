import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {GetEnvironmentBRDFTexture} from '@babylonjs/core/Misc/brdfTextureTools.js';
import {loadGlbContainer} from '../assets/gltfSupport.ts';
import {loadCharacter} from './character.ts';
import {CharacterAnimator,CLIP_MAPPING} from './animation.ts';
import {build,exportCharacter,ROOT,hash} from '../../../../../assets-source/characters/export.mjs';
import {model} from '../../../../../assets-source/characters/model.mjs';
import {validateAssetManifest} from '@stopthatguy/test-support/node';

const input=(speed=0,locomotion='idle',turn=0)=>({position:{x:0,y:0,z:0},yaw:0,speedMps:speed,locomotion,turn});
function setup(){const engine=new NullEngine(),scene=new Scene(engine);return {engine,scene,dispose(){scene.dispose();engine.dispose();}};}
const bytes=id=>new Uint8Array(readFileSync(resolve(ROOT,`apps/client/public/assets/characters/${id}.glb`)));
const resource=s=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,skeletons:s.skeletons.length,groups:s.animationGroups.length,nodes:s.transformNodes.length,observers:s.onDisposeObservable.observers.length});

test('original source and every LOD export reproduce exact hashes; manifest contains real licensed entries',()=>{
 assert.doesNotThrow(()=>build(true));const report=JSON.parse(readFileSync(resolve(ROOT,'assets-source/characters/export-report.json')));
 for(const id of ['player','robber']){const result=exportCharacter(id);assert.equal(result.sha256,hash(bytes(id)));assert.equal(result.sha256,report.characters[id].sha256);assert.ok(result.glb.length<1_500_000);assert.equal(result.doc.skins[0].joints.length,17);assert.deepEqual(result.doc.animations.map(a=>a.name),Object.values(CLIP_MAPPING));const counts=result.lods.map(l=>l.triangles);assert.ok(counts[0]<15000&&counts[1]<5500&&counts[2]<2100,counts.join('/'));assert.ok(counts[0]>counts[1]&&counts[1]>counts[2]);}
 const manifest=JSON.parse(readFileSync(resolve(ROOT,'assets/manifest-characters.json')));
 const validation=validateAssetManifest(manifest,{projectRoot:ROOT,publicDir:resolve(ROOT,'apps/client/public')});assert.equal(validation.ok,true,JSON.stringify(validation.issues));
});

test('all skin weights, normals and index ranges are valid, with adult metre proportions and grounded soles',()=>{
 for(const id of ['player','robber'])for(let lod=0;lod<3;lod++){
  const g=model(id,lod);for(let i=0;i<g.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...g.normals.slice(i,i+3))-1)<1e-8);
  for(let i=0;i<g.weights.length;i+=4){assert.ok(Math.abs(g.weights.slice(i,i+4).reduce((a,b)=>a+b,0)-1)<1e-8);assert.ok(g.weights.slice(i,i+4).every(w=>w>=0&&w<=1));assert.ok(g.joints.slice(i,i+4).every(j=>j>=0&&j<17));}
  assert.ok(Math.max(...g.indices)<g.positions.length/3);const y=g.positions.filter((_,i)=>i%3===1);assert.ok(Math.abs(Math.min(...y)-.003)<.001);assert.ok(Math.abs(Math.max(...y)-1.82)<.005);
 }
});

test('official Babylon decode provides skinned LODs and all five mapped clips, not placeholder shapes',async()=>{
 const env=setup();try{const c=await loadGlbContainer(bytes('player'),env.scene,'player.glb');assert.equal(c.skeletons.length,1);assert.equal(c.skeletons[0].bones.length,17);assert.equal(c.meshes.filter(m=>m.skeleton).length,3);const animator=new CharacterAnimator(c.animationGroups);assert.equal(animator.joints.size,17);assert.equal(c.textures.length,0);animator.dispose();c.dispose();assert.equal(env.scene.skeletons.length,0);}finally{env.dispose();}
});

test('speed-driven blending, synchronized phases, stop/turn continuity and planted stance in actual loaded rig',async()=>{
 const env=setup();try{
  const c=await loadGlbContainer(bytes('player'),env.scene,'player.glb');c.addAllToScene();const a=new CharacterAnimator(c.animationGroups);
  for(let i=0;i<90;i++)a.update(1/60,input(4.8,'run'));assert.ok(a.weights[1]>.999);assert.ok(a.weights[2]<.001);
  const previous=a.weights[2];a.update(1/60,input(7,'sprint'));assert.ok(a.weights[2]>previous&&a.weights[2]<.2,'no instantaneous clip switch');
  for(let i=0;i<90;i++)a.update(1/60,input(7,'sprint'));assert.ok(a.weights[2]>.999);
  for(let i=0;i<90;i++)a.update(1/60,input(.4,'run'));assert.ok(a.weights[0]>.45&&a.weights[0]<.55,'reduced actual speed blends idle and gait');
  for(let i=0;i<120;i++)a.update(1/60,input(0,'sprint',-1));assert.ok(a.weights[0]>.999,'sprint intent at zero motion remains idle');assert.ok(a.turnWeight<-.99);assert.ok(Math.abs(a.joints.get('chest').rotationQuaternion.z)>.03);
  // A full run cycle at 240 Hz. Stance motion relative to root must cancel actual travel.
  for(let i=0;i<120;i++)a.update(1/60,input(4.8,'run'));
  a.phase=0;let last,errors=[],contactY=[];
  for(let i=0;i<120;i++){
   a.update(1/240,input(4.8,'run'));const n=a.joints.get('foot.L');n.computeWorldMatrix(true);const p=n.getAbsolutePosition();
   if(a.phase>.02&&a.phase<.30){contactY.push(p.y);if(last&&a.phase>last.phase)errors.push(Math.abs((p.z-last.z)+4.8/240));}
   last={phase:a.phase,z:p.z};
  }
  assert.ok(errors.length>15);assert.ok(Math.max(...errors)<.001,`stance displacement/frame ${Math.max(...errors)}`);assert.ok(Math.max(...contactY)-Math.min(...contactY)<.003,`contact Y ${Math.min(...contactY)}..${Math.max(...contactY)}`);
  // Nonlinear quaternion blends must never push the ankle below its sole clearance.
  for(const [speed,mode] of [[.2,'run'],[.4,'run'],[.7,'run'],[5.5,'sprint'],[6,'sprint']]){
    for(let i=0;i<90;i++)a.update(1/60,input(speed,mode));
    for(let i=0;i<240;i++){
      a.update(1/120,input(speed,mode));
      for(const side of ['L','R']){const foot=a.joints.get(`foot.${side}`);foot.computeWorldMatrix(true);assert.ok(foot.getAbsolutePosition().y>=.084,`mixed-speed sole penetrates at ${speed}: ${foot.getAbsolutePosition().y}`);}
    }
  }
  // Verify the actual skinned vertex result, not only joint origins.
  const mesh=c.meshes.find(m=>m.name==='player:LOD0');
  for(const speed of [.4,4.8,7]){
    for(let i=0;i<100;i++)a.update(1/60,input(speed,speed>5?'sprint':'run'));
    for(const phase of [.08,.28,.58,.78]){
      a.phase=phase;a.update(0,input(speed,speed>5?'sprint':'run'));
      for(const n of c.transformNodes)n.computeWorldMatrix(true);c.skeletons[0].prepare(true);
      const points=mesh.getPositionData(true,false);let minY=Infinity,maxY=-Infinity;
      for(let i=1;i<points.length;i+=3){minY=Math.min(minY,points[i]);maxY=Math.max(maxY,points[i]);}
      assert.ok(minY>=-.002,`deformed sole penetrates ground: ${speed}/${phase}: ${minY}`);
      assert.ok(maxY>1.45&&maxY<1.84,'deformed body preserves natural metre scale');
    }
  }
  assert.throws(()=>a.update(-1,input()),RangeError);assert.throws(()=>a.update(.016,input(NaN)),RangeError);a.dispose();c.dispose();
 }finally{env.dispose();}
});

test('public lazy character API: LOD hysteresis, bad load/cancel, repeat disposal and scene cleanup',async()=>{
 const env=setup(),originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,{signal}={})=>{if(signal?.aborted)throw signal.reason;if(String(url).includes('missing'))return new Response('',{status:404});return new Response(bytes(String(url).includes('robber')?'robber':'player'));};
 try{
  // Babylon owns one shared BRDF LUT until scene disposal (also used by the street).
  GetEnvironmentBRDFTexture(env.scene);const base=resource(env.scene);
  for(let repeat=0;repeat<3;repeat++){
   const character=await loadCharacter(env.scene,'robber');character.update(.016,input(0),4);assert.equal(character.inspect().lod,0);
   character.update(0,{...input(),position:{x:2,y:1,z:3},yaw:Math.PI/2},4);
   const oriented=character.inspect();
   assert.ok(Math.abs(oriented.feet[0][0]-2)<1e-6&&Math.abs(oriented.feet[0][1]-1.085)<1e-6);
   assert.ok(Math.abs(oriented.feet[0][2]-3.095)<1e-6&&Math.abs(oriented.feet[1][2]-2.905)<1e-6,'retained glTF conversion and positive project yaw');
   character.update(.016,input(),9.5);assert.equal(character.inspect().lod,0);character.update(.016,input(),10.5);assert.equal(character.inspect().lod,1);
   character.setQuality('low');character.update(.016,input(),1);assert.equal(character.inspect().lod,1);character.update(.016,input(),26);assert.equal(character.inspect().lod,2);
   character.dispose();character.dispose();await new Promise(r=>setTimeout(r,10));assert.deepEqual(resource(env.scene),base);assert.throws(()=>character.update(.01,input(),1),/disposed/);
  }
  await assert.rejects(loadCharacter(env.scene,'player',{baseUrl:'http://local/missing/'}),/HTTP 404/);await new Promise(r=>setTimeout(r,10));assert.deepEqual(resource(env.scene),base);
  const boundary=new AbortController();
  const observer=env.scene.onNewTransformNodeAddedObservable.add(node=>{if(node.name==='character.player:placement')queueMicrotask(()=>boundary.abort());});
  await assert.rejects(loadCharacter(env.scene,'player',{signal:boundary.signal}),e=>e.code==='cancelled');
  env.scene.onNewTransformNodeAddedObservable.remove(observer);await new Promise(r=>setTimeout(r,10));assert.deepEqual(resource(env.scene),base);
  const controller=new AbortController();controller.abort();await assert.rejects(loadCharacter(env.scene,'player',{signal:controller.signal}),e=>e.code==='cancelled');await new Promise(r=>setTimeout(r,10));assert.deepEqual(resource(env.scene),base);
  const c=await loadCharacter(env.scene,'player');env.scene.dispose();assert.equal(env.scene.meshes.length,0);assert.equal(env.scene.skeletons.length,0);c.dispose();
 }finally{globalThis.fetch=originalFetch;env.dispose();}
});
