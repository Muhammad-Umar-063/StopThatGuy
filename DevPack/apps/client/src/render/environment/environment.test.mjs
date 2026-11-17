import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { validateAssetManifest } from '@stopthatguy/test-support/node';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ribbon } from './surfaces.ts';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';
import '@babylonjs/loaders/glTF/2.0/index.js';
import { streetPlan, streetGround, QUALITY } from './layout.ts';
import { exportKit, makeKit, ROOT } from '../../../../../assets-source/environment/export.mjs';
import { parts } from '../../../../../assets-source/environment/geometry.mjs';

test('the exact committed world supplies every route, facade and street-furniture anchor',()=>{
  const before=JSON.stringify(FIRST_STREET_WORLD),plan=streetPlan(FIRST_STREET_WORLD);
  assert.equal(plan.worldVersion,'first-street-1'); assert.equal(plan.buildings.length,5); assert.equal(plan.surfaces.length,7);
  for(const segment of plan.surfaces){const edge=FIRST_STREET_WORLD.edges.find(e=>e.id===segment.edgeId); assert.ok(edge.centerline.includes(segment.a)&&edge.centerline.includes(segment.b));
    if(segment.kind==='road')assert.ok(Math.max(...edge.laneOffsetsM.map(Math.abs))<segment.widthM/2);
    else assert.equal(edge.laneOffsetsM.length,1);
  }
  assert.equal(plan.rack.id,'c-bike-stand'); assert.equal(plan.lamp.id,'c-lamp-1');
  assert.equal(JSON.stringify(FIRST_STREET_WORLD),before);
});
test('hill decoration follows the 5% authored grade; unknown worlds/missing anchors fail explicitly',()=>{
  assert.equal(streetGround(60,FIRST_STREET_WORLD),0); assert.equal(streetGround(90,FIRST_STREET_WORLD),1.5); assert.equal(streetGround(120,FIRST_STREET_WORLD),3);
  assert.throws(()=>streetPlan({...FIRST_STREET_WORLD,worldVersion:'other-world'}),/require first-street-1/);
  assert.throws(()=>streetPlan({...FIRST_STREET_WORLD,colliders:FIRST_STREET_WORLD.colliders.filter(c=>c.id!=='c-bank')}),/c-bank/);
  assert.equal(QUALITY.low.shadows,false); assert.equal(QUALITY.medium.shadows,true);
});
test('environment source rebuilds byte-for-byte and provenance validates schema 1',()=>{
  const built=exportKit(true),again=makeKit();assert.deepEqual(built.glb,again.glb);assert.equal(built.sha256,again.sha256);
  assert.ok(built.glb.length<1_500_000,'keep this original kit modest');
  const manifest=JSON.parse(readFileSync(resolve(ROOT,'assets/manifest-environment.json'),'utf8'));
  const report=validateAssetManifest(manifest,{projectRoot:ROOT,publicDir:resolve(ROOT,'apps/client/public')});
  assert.equal(report.ok,true,JSON.stringify(report.issues));assert.deepEqual(report.issues,[]);assert.equal(manifest.assets[0].id,'environment.lisbon-kit');
  assert.equal(manifest.assets[0].technical.triangles,built.technical.triangles);
});
test('all authored normals are finite unit vectors and all primitives have valid triangle indices',()=>{
  makeKit();
  for(const p of parts.values()){
    assert.ok(p.p.every(Number.isFinite),p.name);assert.equal(p.n.length,p.p.length);assert.equal(p.uv.length,p.p.length/3*2);
    for(let i=0;i<p.n.length;i+=3)assert.ok(Math.abs(Math.hypot(...p.n.slice(i,i+3))-1)<1e-6,p.name);
    assert.ok(p.i.every(i=>Number.isInteger(i)&&i>=0&&i<p.p.length/3),p.name);assert.equal(p.i.length%3,0);
  }
});
test('official Babylon decoder reads every kit mesh and exact triangle count (geometry-only Node check)',async()=>{
  const engine=new NullEngine(),scene=new Scene(engine),data=makeKit();
  try{
    // Image upload and actual material response are browser gates, not a NullEngine claim.
    const container=await LoadAssetContainerAsync(new Uint8Array(data.glb),scene,{pluginExtension:'.glb',pluginOptions:{gltf:{skipMaterials:true,animationStartMode:0}}});
    const meshes=container.meshes.filter(m=>m.getTotalVertices());
    assert.equal(meshes.length,data.parts.length);assert.equal(meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),data.technical.triangles);
    for(const part of data.parts)assert.ok(meshes.some(m=>m.name===part.name));
    container.dispose();assert.equal(scene.meshes.length,0);
  }finally{scene.dispose();engine.dispose();}
});


test('street surfaces face upward in the left-handed scene, including graded and reversed paths',()=>{
  const engine=new NullEngine(),scene=new Scene(engine),material=new StandardMaterial('surface test',scene);
  try{
    for(const [a,b] of [[{x:0,y:0,z:0},{x:0,y:1,z:20}],[{x:20,y:0,z:0},{x:0,y:0,z:0}]]){
      const mesh=ribbon(scene,'surface',a,b,9,material);
      const normals=mesh.getVerticesData('normal');
      for(let i=1;i<normals.length;i+=3)assert.ok(normals[i]>.99,'ground must face the camera above it, not be backface-culled');
      mesh.dispose();
    }
  }finally{scene.dispose();engine.dispose();}
});
