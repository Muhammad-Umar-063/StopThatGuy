// T015 presentation fixture, not simulation, networking, gameplay bootstrap or T010 camera.
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { FIRST_STREET_WORLD } from '@stopthatguy/world';
import { loadVisualAsset, type VisualAsset } from '../assets/loadVisualAsset.js';
import { createStreetEnvironment, type StreetEnvironment } from '../environment/streetEnvironment.js';
import { QUALITY, streetGround } from '../environment/layout.js';
import { loadCharacter, type Character, type CharacterQuality } from './character.js';
import type { CharacterPresentation, Locomotion } from './animation.js';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,status=document.querySelector<HTMLElement>('#status')!,cost=document.querySelector<HTMLElement>('#cost')!;
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}),scene=new Scene(engine),metrics=new SceneInstrumentation(scene);
scene.useRightHandedSystem=false;
const camera=new FreeCamera('Provisional character review camera',new Vector3(0,2.4,13),scene);camera.minZ=.1;camera.maxZ=160;camera.fov=.78;
const target=new Vector3(),eye=new Vector3();
let streetAsset:VisualAsset|undefined,street:StreetEnvironment|undefined,characters:Character[]=[],pending:AbortController|undefined,quality:CharacterQuality='medium',state='loading',failure:string|null=null,view=0,frames=0,paused=false,speed=0,centerX=0,mode:Locomotion='idle',turn=0,z=18,yaw=0,disposed=false;
const input={position:{x:0,y:0,z:18},yaw:0,speedMps:0,locomotion:'idle' as Locomotion,turn:0,slope:0};
const drawSamples=new Uint16Array(30);let drawIndex=0;
function resources(){return {meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length,skeletons:scene.skeletons.length,animationGroups:scene.animationGroups.length,transformNodes:scene.transformNodes.length,disposeObservers:scene.onDisposeObservable.observers.length};}
let baseResources:ReturnType<typeof resources>|undefined;
function snapshot(){let draws=0;for(const n of drawSamples)draws=Math.max(draws,n);return {state,failure,quality,view,frames,paused,speed,mode,turn,worldVersion:FIRST_STREET_WORLD.worldVersion,renderer:engine.getGlInfo().renderer,drawCalls:draws,renderSize:[engine.getRenderWidth(),engine.getRenderHeight()],resources:resources(),baseResources,street:street?.costs(),characters:characters.map(c=>c.inspect())};}
function setView(value:number){view=value%4;z=view===2?82:18;yaw=0;centerX=0;drawSamples.fill(0);update(0);}
function setQuality(value:CharacterQuality){quality=value;street?.setQuality(value);characters.forEach(c=>c.setQuality(value));engine.setHardwareScalingLevel(1/(Math.min(devicePixelRatio,1.5)*QUALITY[value].resolutionScale));drawSamples.fill(0);for(const q of ['low','medium'])document.querySelector(`#${q}`)!.setAttribute('aria-pressed',String(q===value));}
function setMotion(next:Locomotion,actualSpeed:number,turnEffort=0){mode=next;speed=actualSpeed;turn=turnEffort;status.textContent=`${mode} · actual speed ${speed.toFixed(2)} m/s · turn ${turn.toFixed(1)}`;}
function update(dt:number){
  if(state!=='ready')return;
  if(!paused){yaw+=turn*dt*.55;centerX+=Math.sin(yaw)*speed*dt;z+=Math.cos(yaw)*speed*dt;if(z>(view===2?105:44)||Math.abs(centerX)>2){z=view===2?82:18;centerX=0;yaw=0;}}
  const ground=streetGround(z,FIRST_STREET_WORLD),slope=view===2?Math.atan(.05):0;
  // Moving camera is a fixed review offset, not the gameplay chase camera.
  if(view===1){eye.set(centerX+1.8,ground+1.65,z+4.2);target.set(centerX,ground+1.15,z);}
  else {eye.set(centerX+1.4,ground+2.2,z-(view===3?28:4.3));target.set(centerX,ground+1.15,z+.3);}
  camera.position.copyFrom(eye);camera.setTarget(target);
  for(let i=0;i<characters.length;i++){
    input.position.x=centerX+(i===0?-.68:.68);input.position.y=ground;input.position.z=z;input.yaw=yaw;input.speedMps=speed;input.locomotion=mode;input.turn=turn;input.slope=slope;
    characters[i]!.update(paused?0:dt,input,Math.hypot(camera.position.x-input.position.x,camera.position.y-input.position.y,camera.position.z-input.position.z));
  }
}
function unloadCharacters(){pending?.abort();pending=undefined;for(const c of characters)c.dispose();characters=[];state='unloaded';}
async function reload(baseUrl?:string){
  unloadCharacters();state='loading';failure=null;status.textContent='Loading skinned characters…';const controller=new AbortController();pending=controller;
  try{
    // Allow deferred Babylon observer removal before taking the current-quality baseline.
    await new Promise(resolve=>setTimeout(resolve,0));if(controller.signal.aborted)return;
    baseResources=resources();
    for(const identity of ['player','robber'] as const){const c=await loadCharacter(scene,identity,{quality,signal:controller.signal,baseUrl});if(controller.signal.aborted){c.dispose();return;}characters.push(c);}
    await scene.whenReadyAsync();if(controller.signal.aborted)return;state='ready';update(0);setMotion(mode,speed,turn);
  }catch(e){if(controller.signal.aborted)return;for(const c of characters)c.dispose();characters=[];failure=e instanceof Error?e.message:String(e);state='failed';status.textContent=`Load failed: ${failure}. Use Reload to retry.`;}
  finally{if(pending===controller)pending=undefined;}
}
async function cancellation(){const before=resources(),abort=new AbortController(),promise=loadCharacter(scene,'player',{signal:abort.signal});abort.abort();let code='unexpected success';try{const c=await promise;c.dispose();}catch(e){code=(e as {code?:string}).code??String(e);}return {code,before,after:resources()};}
const events=new AbortController();
const bind=(id:string,fn:()=>void)=>document.querySelector(`#${id}`)!.addEventListener('click',fn,{signal:events.signal});
const motions={idle:()=>setMotion('idle',0),run:()=>setMotion('run',4.8),sprint:()=>setMotion('sprint',7),left:()=>setMotion('run',3.2,-1),right:()=>setMotion('run',3.2,1)};
for(const [key,fn] of Object.entries(motions))bind(key,fn);
bind('low',()=>setQuality('low'));bind('medium',()=>setQuality('medium'));bind('camera',()=>setView(view+1));bind('pause',()=>{paused=!paused;});bind('reload',()=>{void reload();});
window.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.code==='Space'&&e.target instanceof HTMLButtonElement)return; // preserve native button activation
  const key:Record<string,()=>void>={Digit1:motions.idle,Digit2:motions.run,Digit3:motions.sprint,Digit4:motions.left,Digit5:motions.right,KeyL:()=>setQuality('low'),KeyM:()=>setQuality('medium'),KeyC:()=>setView(view+1),Space:()=>{paused=!paused;},ArrowUp:()=>setMotion(speed>=5?'sprint':'run',Math.min(8,speed+.4),turn),ArrowDown:()=>setMotion('run',Math.max(0,speed-.4),turn)};
  if(key[e.code]){e.preventDefault();if(!e.repeat)key[e.code]!();}
},{signal:events.signal});
window.addEventListener('resize',()=>engine.resize(),{signal:events.signal});
const render=()=>{update(Math.min(.05,engine.getDeltaTime()/1000));scene.render();frames++;drawSamples[drawIndex++%30]=metrics.drawCallsCounter.current;
  if(frames%30===0)updateCost();};
function updateCost(){if(state==='ready'){const s=snapshot();cost.textContent=`${quality.toUpperCase()} · ${s.renderSize.join(' × ')} · ${s.drawCalls} scene draw calls\n${s.characters.map(c=>`${c.identity}: LOD${c.lod}, ${c.triangles.toLocaleString()} triangles, ${c.joints} joints`).join(' · ')}\n${((s.characters.reduce((n,c)=>n+c.vertexAndIndexBytes,0))/1048576).toFixed(2)} MiB native geometry buffer capacity · no character image textures\n${s.street?.triangles.toLocaleString()} street triangles · ${((s.street?.estimatedTextureBytes??0)/1048576).toFixed(2)} MiB estimated street RGBA+mips`;}};
function shutdown(){if(disposed)return;disposed=true;unloadCharacters();street?.dispose();streetAsset?.dispose();events.abort();engine.stopRenderLoop(render);metrics.dispose();scene.dispose();engine.dispose();state='disposed';}
async function renderFrames(count=3){
  await scene.whenReadyAsync();
  for(let i=0;i<count;i++){await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));engine.beginFrame();render();engine.endFrame();}
  updateCost();
}
Object.assign(window,{__characters:{manualFrames:()=>engine.stopRenderLoop(render),renderFrames,snapshot,setView,setQuality,setMotion,reload,unload:unloadCharacters,cancellation,shutdown,pause:(p:boolean)=>{paused=p;},step:(dt:number)=>{const was=paused;paused=false;update(dt);paused=was;},advance:(seconds:number)=>{const was=paused;paused=false;for(let t=0;t<seconds-1e-8;t+=1/120)update(Math.min(1/120,seconds-t));paused=was;}}});
window.addEventListener('pagehide',shutdown,{once:true,signal:events.signal});engine.runRenderLoop(render);
void (async()=>{try{streetAsset=await loadVisualAsset(scene,'environment.lisbon-kit');street=createStreetEnvironment(scene,FIRST_STREET_WORLD,streetAsset.container,quality);await scene.whenReadyAsync();baseResources=resources();setQuality(quality);await reload();}catch(e){failure=String(e);state='failed';status.textContent=failure;}})();
