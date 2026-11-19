import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {Ray} from '@babylonjs/core/Culling/ray.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {GetEnvironmentBRDFTexture} from '@babylonjs/core/Misc/brdfTextureTools.js';
import {WORLD_LAYOUT_LIMITS} from '@stopthatguy/test-support';
import {validateAssetManifest} from '@stopthatguy/test-support/node';
import {LISBON_CITY_WORLD} from '@stopthatguy/world';
import {loadVehicle} from './vehicle.ts';
import {fitCharacter} from './staticFit.ts';
import {loadCharacter} from '../characters/character.ts';
import {VEHICLE_DEFINITIONS} from './definitions.ts';
import {build,exportVehicle,ROOT,hash} from '../../../../../assets-source/vehicles/export.mjs';
import {model} from '../../../../../assets-source/vehicles/model.mjs';
const types=['bicycle','scooter','lift'];
const bytes=(type,folder='vehicles')=>new Uint8Array(readFileSync(resolve(ROOT,`apps/client/public/assets/${folder}/${type}.glb`)));
const input=(extra={})=>({position:{x:0,y:0,z:0},yaw:0,speedMps:0,steeringRadians:0,...extra});
const resources=s=>({meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,nodes:s.transformNodes.length,observers:s.onDisposeObservable.observers.length,skeletons:s.skeletons.length,groups:s.animationGroups.length});
const settle=()=>new Promise(r=>setTimeout(r,10));
async function fixture(fn){
 const engine=new NullEngine(),scene=new Scene(engine),fetch=globalThis.fetch;
 globalThis.fetch=async(url,{signal}={})=>{if(signal?.aborted)throw signal.reason;if(String(url).includes('missing'))return new Response('',{status:404});const path=String(url).split('/');return new Response(bytes(path.at(-1).replace('.glb',''),path.at(-2)));};
 try{GetEnvironmentBRDFTexture(scene);await fn(scene);}finally{globalThis.fetch=fetch;scene.dispose();engine.dispose();}
}
const close=(a,b,tol=1e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test('reproducible licensed GLBs, three economical LODs and exact committed clearance references',()=>{
 assert.doesNotThrow(()=>build(true));
 const manifest=JSON.parse(readFileSync(resolve(ROOT,'assets/manifest-vehicles.json')));
 assert.equal(validateAssetManifest(manifest,{projectRoot:ROOT,publicDir:resolve(ROOT,'apps/client/public')}).ok,true);
 for(const type of types){const result=exportVehicle(type),def=VEHICLE_DEFINITIONS[type];assert.equal(result.sha256,hash(bytes(type)));assert.ok(result.glb.length<600000);assert.ok(result.lods[0].triangles>=3000&&result.lods[0].triangles<=8000);assert.ok(result.lods[0].triangles>result.lods[1].triangles&&result.lods[1].triangles>result.lods[2].triangles);assert.equal(result.doc.materials.length,1);assert.equal(result.doc.textures,undefined);assert.deepEqual({radiusM:def.clearance.radiusM,heightM:def.clearance.heightM},WORLD_LAYOUT_LIMITS.spawnFootprint[type]);for(const name of Object.keys(def.anchors))assert.ok(result.doc.nodes.some(n=>n.name===`anchor.${name}`));}
 assert.equal(VEHICLE_DEFINITIONS.lift.seats.filter(s=>s.role==='passenger').length,2);
 assert.deepEqual([...new Set(LISBON_CITY_WORLD.spawns.filter(s=>s.kind==='vehicle').map(s=>s.vehicleType))].sort(),types.slice().sort());
 assert.ok(LISBON_CITY_WORLD.routes.some(r=>r.id==='city-r-lift-circuit'));
});

test('original surfaces have finite unit normals, valid indices, outward winding and no degenerate triangles',()=>{
 for(const type of types)for(let lod=0;lod<3;lod++)for(const {geometry:g,name} of model(type,lod)){
  assert.ok(g.positions.every(Number.isFinite));for(let i=0;i<g.normals.length;i+=3)close(Math.hypot(...g.normals.slice(i,i+3)),1);
  assert.ok(g.indices.every(i=>Number.isInteger(i)&&i>=0&&i<g.positions.length/3));
  for(let i=0;i<g.indices.length;i+=3){const ids=g.indices.slice(i,i+3),p=ids.map(k=>Vector3.FromArray(g.positions,k*3));const cross=Vector3.Cross(p[1].subtract(p[0]),p[2].subtract(p[0]));assert.ok(cross.length()>1e-12,`${type}/${lod}/${name} degenerate ${i/3}`);const normal=ids.map(k=>Vector3.FromArray(g.normals,k*3)).reduce((a,b)=>a.add(b),Vector3.Zero());assert.ok(Vector3.Dot(cross,normal)>0,`${type}/${lod}/${name} inward ${i/3}`);}
 }
});

test('official lazy import: metre bounds, retained glTF conversion, articulation and stable LOD anchors',async()=>fixture(async scene=>{
 for(const type of types){
  const v=await loadVehicle(scene,type),def=v.definition;v.update(0,input(),4);const original=v.inspect();assert.equal(original.lod,0);assert.equal(original.imageTextures,0);assert.equal(original.materials,2);
  const [,y]=original.bounds.max.map((n,i)=>Math.max(Math.abs(n),Math.abs(original.bounds.min[i])));let radius=0;for(const mesh of scene.meshes.filter(m=>m.name.startsWith(type+':')&&m.name.endsWith(':LOD0'))){const positions=mesh.getVerticesData('position');for(let i=0;i<positions.length;i+=3){const p=Vector3.TransformCoordinates(Vector3.FromArray(positions,i),mesh.computeWorldMatrix(true));radius=Math.max(radius,Math.hypot(p.x,p.z));}}assert.ok(radius<=def.clearance.radiusM+.002,`${type} parked radius ${radius}`);assert.ok(y<=def.clearance.heightM);close(original.bounds.min[1],0,.004);
  for(const wheel of def.wheels){const node=scene.getTransformNodeByName(wheel.pivot);node.computeWorldMatrix(true);close(node.absolutePosition.y,wheel.radiusM);}
  for(const seat of def.seats)for(const name of seat.feet){const contact=Vector3.FromArray(original.anchors[name]);const ray=new Ray(contact.add(new Vector3(0,.005,0)),new Vector3(0,-1,0),.05);const hits=scene.meshes.filter(m=>m.name.startsWith(type+':')&&m.name.endsWith(':LOD0')).map(m=>ray.intersectsMesh(m,false)).filter(h=>h.hit);assert.ok(hits.length>0,`${type}/${name} has no physical support at sole contact`);assert.ok(Math.min(...hits.map(h=>h.distance))<=.035,`${type}/${name} floats above support`);}
  if(type==='lift')for(const x of [-.65,.65])for(const z of [-.99,.99]){const ray=new Ray(new Vector3(x,.7,z),new Vector3(0,-1,0),.2);const body=scene.getMeshByName('lift:coachwork:LOD0');const hit=ray.intersectsMesh(body,false);assert.ok(hit.hit&&hit.distance<.1,'fender must cover tire crown');}
  const right=original.anchors[def.seats[0].hands[1]],left=original.anchors[def.seats[0].hands[0]];assert.ok(right[0]>left[0]);
  v.update(.1,input({speedMps:2,steeringRadians:.3,pedalAngleRadians:.4}),4);const articulated=v.inspect();close(articulated.wheelAngles[0],.2/def.wheels[0].radiusM);if(type!=='lift')assert.notDeepEqual(articulated.anchors[def.seats[0].hands[0]],original.anchors[def.seats[0].hands[0]]);
  for(const name of def.steering){const steering=scene.getTransformNodeByName(name);const forward=Vector3.TransformNormal(new Vector3(0,0,1),steering.computeWorldMatrix(true)).normalize();close(forward.x,Math.sin(.3));close(forward.z,Math.cos(.3));}
  for(const wheel of def.wheels){const node=scene.getTransformNodeByName(wheel.pivot);node.computeWorldMatrix(true);close(node.absolutePosition.y,wheel.radiusM);const source=def.pivots[wheel.pivot],parent=source.parent?def.pivots[source.parent]:null;close(node.absolutePosition.x,source.position[0]+(parent?.position[0]??0));close(node.absolutePosition.z,source.position[2]+(parent?.position[2]??0));}
  if(type==='bicycle')assert.notDeepEqual(articulated.anchors['foot.rider.L'],original.anchors['foot.rider.L']);
  v.update(0,input({position:{x:2,y:1,z:3},yaw:Math.PI/2}),4);const transformed=v.inspect();for(const [name,p] of Object.entries(original.anchors)){const q=transformed.anchors[name];close(q[0],2+p[2]);close(q[1],1+p[1]);close(q[2],3-p[0]);}
  for(const [distance,lod] of [[12.5,0],[13.1,1],[30.5,1],[31.1,2],[29.5,2],[28.9,1]]){v.update(0,input(),distance);assert.equal(v.inspect().lod,lod);assert.deepEqual(v.inspect().anchors,original.anchors);}
  v.setQuality('low');v.update(0,input(),1);assert.equal(v.inspect().lod,1);v.update(0,input(),20);assert.equal(v.inspect().lod,2);
  assert.throws(()=>v.update(.3,input(),1),RangeError);assert.throws(()=>v.update(0,input({yaw:NaN}),1),RangeError);assert.throws(()=>v.setQuality('ultra'),RangeError);assert.throws(()=>v.anchorToRef('absent',new Vector3()),RangeError);v.dispose();
 }
}));

test('actual integrated character rig fits seats, palms and soles at transformed anchors in every LOD',async()=>fixture(async scene=>{
 for(const type of types){const v=await loadVehicle(scene,type);for(const identity of ['player','robber']){const c=await loadCharacter(scene,identity);
  for(const yaw of [0,Math.PI/2])for(const quality of ['low','medium'])for(const distance of [4,45]){v.setQuality(quality);c.setQuality(quality);v.update(0,input({position:{x:1,y:.7,z:18},yaw}),distance);for(const seat of v.definition.seats){const fit=fitCharacter(c,v,seat,yaw,distance);assert.ok(fit.seatErrorM<.001);for(const p of [...fit.hands,...fit.feet])assert.ok(p.errorM<.012,`${type}/${identity}/${seat.id} fit error ${p.errorM}, reach ${p.reach}/${p.available}`);
   // Inspect real skinned sole vertices, not only solver endpoints.
   for(const node of c.animator.joints.values())node.computeWorldMatrix(true);
   const mesh=scene.getMeshByName(`${identity}:LOD${c.inspect().lod}`);mesh.skeleton.prepare(true);const points=mesh.getPositionData(true,false),matrix=mesh.computeWorldMatrix(true);let minY=Infinity;
   for(let i=0;i<points.length;i+=3)minY=Math.min(minY,Vector3.TransformCoordinates(Vector3.FromArray(points,i),matrix).y);
   const anchors=v.inspect().anchors,contactY=Math.min(...seat.feet.map(name=>anchors[name][1]));assert.ok(minY>=contactY-.003&&minY<=contactY+.006,`${type}/${identity}/${seat.id} deformed sole ${minY} versus contact ${contactY}`);
  }}
  c.dispose();}v.dispose();}
}));

test('load errors, cancellation at completion, repeated disposal and scene shutdown clean owned resources',async()=>fixture(async scene=>{
 const base=resources(scene);
 for(let i=0;i<3;i++){const all=[];for(const type of types)all.push(await loadVehicle(scene,type));for(const v of all){v.dispose();v.dispose();assert.throws(()=>v.inspect(),/disposed/);}await settle();assert.deepEqual(resources(scene),base);}
 await assert.rejects(loadVehicle(scene,'bicycle',{baseUrl:'http://local/missing/'}),/HTTP 404/);await settle();assert.deepEqual(resources(scene),base);
 const abort=new AbortController();const listener=scene.onNewTransformNodeAddedObservable.add(n=>{if(n.name==='vehicle.bicycle:placement')queueMicrotask(()=>abort.abort());});await assert.rejects(loadVehicle(scene,'bicycle',{signal:abort.signal}),e=>e.code==='cancelled');scene.onNewTransformNodeAddedObservable.remove(listener);await settle();assert.deepEqual(resources(scene),base);
 const early=new AbortController();early.abort();await assert.rejects(loadVehicle(scene,'lift',{signal:early.signal}),e=>e.code==='cancelled');await assert.rejects(loadVehicle(scene,'lift',{quality:'ultra'}),RangeError);await settle();assert.deepEqual(resources(scene),base);
 const v=await loadVehicle(scene,'lift');scene.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.transformNodes.length,0);v.dispose();
}));
