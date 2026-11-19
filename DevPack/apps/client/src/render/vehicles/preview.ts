// Isolated presentation fixture. No driving, boarding, camera gameplay or rider animation.
import {Engine} from '@babylonjs/core/Engines/engine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {FreeCamera} from '@babylonjs/core/Cameras/freeCamera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {SceneInstrumentation} from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import {FIRST_STREET_WORLD} from '@stopthatguy/world';
import type {VehicleType} from '@stopthatguy/shared';
import {loadVisualAsset,type VisualAsset} from '../assets/loadVisualAsset.js';
import {createStreetEnvironment,type StreetEnvironment} from '../environment/streetEnvironment.js';
import {QUALITY,streetGround} from '../environment/layout.js';
import {loadCharacter,type Character} from '../characters/character.js';
import {loadVehicle,type VehicleVisual} from './vehicle.js';
import type {VehicleQuality} from './definitions.js';
import {fitCharacter} from './staticFit.js';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,status=document.querySelector<HTMLElement>('#status')!,cost=document.querySelector<HTMLElement>('#cost')!;
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}),scene=new Scene(engine),metrics=new SceneInstrumentation(scene);
scene.useRightHandedSystem=false;
const camera=new FreeCamera('Provisional transport review camera',new Vector3(3,2.3,14),scene);camera.minZ=.1;camera.maxZ=160;camera.fov=.72;
let streetAsset:VisualAsset|undefined,street:StreetEnvironment|undefined,vehicle:VehicleVisual|undefined,characters:Character[]=[],pending:AbortController|undefined;
let quality:VehicleQuality='medium',type:VehicleType='bicycle',state='loading',failure:string|null=null,view=0,frames=0,fitVisible=false,speed=0,steer=0,pedal=0,disposed=false;
let fits:ReturnType<typeof fitCharacter>[]=[];
const drawSamples=new Uint16Array(20);let drawIndex=0;
function resources(){return {meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length,skeletons:scene.skeletons.length,animationGroups:scene.animationGroups.length,transformNodes:scene.transformNodes.length,disposeObservers:scene.onDisposeObservable.observers.length};}
let baseResources:ReturnType<typeof resources>|undefined;
function snapshot(){return {state,failure,type,quality,view,frames,fitVisible,speed,steer,worldVersion:FIRST_STREET_WORLD.worldVersion,renderer:engine.getGlInfo().renderer,drawCalls:Math.max(...drawSamples),submittedTriangles:scene.getActiveIndices()/3,activeMeshes:scene.getActiveMeshes().length,sceneTextureInventory:scene.textures.map(t=>({name:t.name,width:t.getSize().width,height:t.getSize().height})),renderSize:[engine.getRenderWidth(),engine.getRenderHeight()],resources:resources(),baseResources,street:street?.costs(),vehicle:vehicle?.inspect(),characters:characters.map(c=>c.inspect()),fits};}
function update(dt:number){
 if(state!=='ready'||!vehicle)return;
 const z=view===3?82:18,ground=streetGround(z,FIRST_STREET_WORLD),lift=type==='lift',yaw=view===4?Math.PI/2:0;
 const offsets=view===1?[3.7,1.7,3.5]:view===2?[lift?5.5:4.2,1.5,0]:view===5?[3,4,-38]:[lift?3.5:2.1,lift?2.6:1.9,lift?-6:-4.5];
 camera.position.set(offsets[0]!,ground+offsets[1]!,z+offsets[2]!);camera.setTarget(new Vector3(0,ground+(lift?1:.85),z));
 const distance=Vector3.Distance(camera.position,new Vector3(0,ground,z));pedal+=dt*speed*2;
 vehicle.update(dt,{position:{x:0,y:ground,z},yaw,speedMps:speed,steeringRadians:steer,pedalAngleRadians:pedal},distance);
 fits=characters.map((c,i)=>fitCharacter(c,vehicle!,vehicle!.definition.seats[i]!,yaw,distance));
}
function setView(value:number){view=value%6;drawSamples.fill(0);update(0);}
function setQuality(value:VehicleQuality){quality=value;street?.setQuality(value);vehicle?.setQuality(value);characters.forEach(c=>c.setQuality(value));engine.setHardwareScalingLevel(1/(Math.min(devicePixelRatio,1.5)*QUALITY[value].resolutionScale));drawSamples.fill(0);for(const q of ['low','medium'])document.querySelector(`#${q}`)!.setAttribute('aria-pressed',String(q===value));update(0);}
function unload(){pending?.abort();pending=undefined;for(const c of characters)c.dispose();characters=[];fits=[];vehicle?.dispose();vehicle=undefined;state='unloaded';}
async function reload(baseUrl?:string){
 unload();state='loading';failure=null;status.textContent='Loading original transport…';const controller=new AbortController();pending=controller;
 try{
  await new Promise(resolve=>setTimeout(resolve,0));if(controller.signal.aborted)return;baseResources=resources();
  const loaded=await loadVehicle(scene,type,{quality,signal:controller.signal,baseUrl});if(controller.signal.aborted){loaded.dispose();return;}loaded.setQuality(quality);vehicle=loaded;
  if(fitVisible)for(let i=0;i<vehicle.definition.seats.length;i++){const c=await loadCharacter(scene,i===2?'robber':'player',{quality,signal:controller.signal});if(controller.signal.aborted){c.dispose();return;}c.setQuality(quality);characters.push(c);}
  await scene.whenReadyAsync();if(controller.signal.aborted)return;state='ready';update(0);status.textContent=`${vehicle.definition.label} · ${fitVisible?'static contact fit':'art view'} · +Z forward`;
 }catch(e){if(controller.signal.aborted)return;for(const c of characters)c.dispose();characters=[];vehicle?.dispose();vehicle=undefined;failure=e instanceof Error?e.message:String(e);state='failed';status.textContent=`Load failed: ${failure}. Use Reload to retry.`;}
 finally{if(pending===controller)pending=undefined;}
}
async function select(value:VehicleType){type=value;speed=0;steer=0;pedal=0;for(const t of ['bicycle','scooter','lift'])document.querySelector(`#${t}`)!.setAttribute('aria-pressed',String(t===value));await reload();}
async function setFit(value:boolean){fitVisible=value;document.querySelector('#fit')!.setAttribute('aria-pressed',String(value));await reload();}
async function cancellation(){const abort=new AbortController(),promise=loadVehicle(scene,type,{signal:abort.signal});abort.abort();try{const v=await promise;v.dispose();return 'unexpected success';}catch(e){return (e as {code?:string}).code??String(e);}}
const events=new AbortController(),bind=(id:string,fn:()=>void)=>document.querySelector(`#${id}`)!.addEventListener('click',fn,{signal:events.signal});
for(const t of ['bicycle','scooter','lift'] as const)bind(t,()=>{void select(t);});bind('low',()=>setQuality('low'));bind('medium',()=>setQuality('medium'));bind('camera',()=>setView(view+1));bind('fit',()=>{void setFit(!fitVisible);});bind('motion',()=>{speed=speed?0:2;});bind('reload',()=>{void reload();});
window.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||(e.code==='Space'&&e.target instanceof HTMLButtonElement))return;const actions:Record<string,()=>void>={Digit1:()=>{void select('bicycle');},Digit2:()=>{void select('scooter');},Digit3:()=>{void select('lift');},KeyL:()=>setQuality('low'),KeyM:()=>setQuality('medium'),KeyC:()=>setView(view+1),KeyF:()=>{void setFit(!fitVisible);},KeyW:()=>{speed=speed?0:2;},Space:()=>{speed=0;},ArrowLeft:()=>{steer=Math.max(-.4,steer-.1);},ArrowRight:()=>{steer=Math.min(.4,steer+.1);}};if(actions[e.code]){e.preventDefault();if(!e.repeat)actions[e.code]!();}},{signal:events.signal});
window.addEventListener('resize',()=>engine.resize(),{signal:events.signal});
const render=()=>{update(Math.min(.05,engine.getDeltaTime()/1000));scene.render();frames++;drawSamples[drawIndex++%20]=metrics.drawCallsCounter.current;if(frames%30===0)updateCost();};
function updateCost(){if(!vehicle)return;const s=snapshot(),v=s.vehicle!;cost.textContent=`${quality.toUpperCase()} · ${s.renderSize.join(' × ')} · ${s.drawCalls} scene draws · ${s.submittedTriangles.toLocaleString()} submitted triangles\n${type}: LOD${v.lod}, ${v.triangles.toLocaleString()} triangles + ${v.contactTriangles} contact shadow · ${v.materials} materials · 0 image textures\n${(v.bufferBytes/1048576).toFixed(2)} MiB native vehicle buffers (all LODs resident)\n${s.street?.triangles.toLocaleString()} street triangles · ${s.characters.reduce((n,c)=>n+c.triangles+c.contactTriangles,0).toLocaleString()} static-fit character triangles`;
}
function shutdown(){if(disposed)return;disposed=true;unload();street?.dispose();streetAsset?.dispose();events.abort();engine.stopRenderLoop(render);metrics.dispose();scene.dispose();engine.dispose();state='disposed';}
async function renderFrames(count=3){await scene.whenReadyAsync();for(let i=0;i<count;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));engine.beginFrame();render();engine.endFrame();}updateCost();}
Object.assign(window,{__vehicles:{snapshot,select,reload,setFit,setQuality,setView,unload,cancellation,shutdown,renderFrames,manualFrames:()=>engine.stopRenderLoop(render),motion:(value:number,steering=0)=>{speed=value;steer=steering;},advance:(seconds:number)=>{for(let t=0;t<seconds-1e-8;t+=1/120)update(Math.min(1/120,seconds-t));}}});
window.addEventListener('pagehide',shutdown,{once:true,signal:events.signal});engine.runRenderLoop(render);
void (async()=>{try{streetAsset=await loadVisualAsset(scene,'environment.lisbon-kit');street=createStreetEnvironment(scene,FIRST_STREET_WORLD,streetAsset.container,quality);await scene.whenReadyAsync();setQuality(quality);await select(type);}catch(e){failure=String(e);state='failed';status.textContent=failure;}})();
