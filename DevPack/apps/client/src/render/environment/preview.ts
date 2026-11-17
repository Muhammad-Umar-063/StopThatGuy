// Standalone development preview only. The actual T010 camera belongs to its owner.
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { Scene } from "@babylonjs/core/scene.js";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation.js";
import { FIRST_STREET_WORLD } from "@stopthatguy/world";
import { ASSET_CATALOG, type AssetId } from "../assets/catalog.js";
import { loadVisualAsset, type VisualAsset } from "../assets/loadVisualAsset.js";
import { createStreetEnvironment, type StreetEnvironment } from "./streetEnvironment.js";
import { ENVIRONMENT_ASSET_ID, QUALITY, streetGround, type StreetQuality } from "./layout.js";

const canvas=document.querySelector<HTMLCanvasElement>('#view')!,state=document.querySelector<HTMLElement>('#state')!,cost=document.querySelector<HTMLElement>('#cost')!;
const engine=new Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
const scene=new Scene(engine);scene.useRightHandedSystem=false;
const camera=new FreeCamera('PROVISIONAL preview camera',new Vector3(0,3.4,8),scene);camera.minZ=.2;camera.maxZ=180;camera.fov=.94;
const metrics=new SceneInstrumentation(scene);
const marker=CreateCapsule('PROVISIONAL 1.7 m player-scale marker',{height:1.7,radius:.26,tessellation:16},scene);
const markerMaterial=new StandardMaterial('placeholder amber',scene);markerMaterial.diffuseColor=Color3.FromHexString('#e8a638');marker.material=markerMaterial;marker.isPickable=false;
const views=[
  {name:'Bank approach',eye:new Vector3(0,3.2,8),target:new Vector3(-1,2.5,34),marker:new Vector3(0,.85,15)},
  {name:'Alley junction',eye:new Vector3(1.8,3.1,54),target:new Vector3(-17,2.6,61),marker:new Vector3(-4,.85,60)},
  {name:'Hill grade',eye:new Vector3(.4,4.3,78),target:new Vector3(0,4.5,110),marker:new Vector3(0,streetGround(87,FIRST_STREET_WORLD)+.85,87)},
];
let view=0,quality:StreetQuality='medium',asset:VisualAsset|undefined,environment:StreetEnvironment|undefined,pending:AbortController|undefined,frames=0,failure:string|null=null;
let frameCosts:number[]=[];
function chooseView(index:number){view=index%views.length;const v=views[view]!;camera.position.copyFrom(v.eye);camera.setTarget(v.target);marker.position.copyFrom(v.marker);frameCosts=[];}
function chooseQuality(value:StreetQuality){quality=value;environment?.setQuality(value);engine.setHardwareScalingLevel(1/(Math.min(devicePixelRatio,1.5)*QUALITY[value].resolutionScale));frameCosts=[];
  for(const q of ['low','medium'])document.querySelector(`#${q}`)!.setAttribute('aria-pressed',String(q===quality));}
function snapshot(){return{state:document.documentElement.dataset.streetState,quality,view:views[view]!.name,frames,failure,costs:environment?.costs()??null,
  drawCalls:frameCosts.length?Math.max(...frameCosts):0,activeMeshes:scene.getActiveMeshes().length,sceneMeshes:scene.meshes.length,sceneMaterials:scene.materials.length,sceneTextures:scene.textures.length,
  renderSize:[engine.getRenderWidth(),engine.getRenderHeight()],worldVersion:FIRST_STREET_WORLD.worldVersion,anchors:environment?.anchorIds??[],renderer:engine.getGlInfo().renderer};}
function unload(){pending?.abort();pending=undefined;environment?.dispose();environment=undefined;asset?.dispose();asset=undefined;document.documentElement.dataset.streetState='unloaded';}
async function reload(){unload();failure=null;const request=new AbortController();pending=request;document.documentElement.dataset.streetState='loading';state.textContent='Loading architectural kit…';
  try{
    // This check deliberately blocks until the coordinator registers the stable ID.
    // No local catalog mutation, unregistered URL or loader fallback bypasses ownership.
    if(!Object.hasOwn(ASSET_CATALOG,ENVIRONMENT_ASSET_ID))throw new Error('Awaiting coordinated catalog registration for environment.lisbon-kit.');
    const loaded=await loadVisualAsset(scene,ENVIRONMENT_ASSET_ID as AssetId,{signal:request.signal});
    if(request.signal.aborted){loaded.dispose();return;}asset=loaded;
    environment=createStreetEnvironment(scene,FIRST_STREET_WORLD,loaded.container,quality);chooseQuality(quality);chooseView(view);
    await scene.whenReadyAsync();if(request.signal.aborted)return;
    document.documentElement.dataset.streetState='ready';state.textContent='World-aligned street loaded · first-street-1';
  }catch(error){if(request.signal.aborted)return;environment?.dispose();environment=undefined;asset?.dispose();asset=undefined;failure=error instanceof Error?error.message:String(error);state.textContent=failure;document.documentElement.dataset.streetState='failed';}
  finally{if(pending===request)pending=undefined;}
}
const listeners=new AbortController();
for(const q of ['low','medium'] as const)document.querySelector(`#${q}`)!.addEventListener('click',()=>chooseQuality(q),{signal:listeners.signal});
document.querySelector('#viewpoint')!.addEventListener('click',()=>chooseView(view+1),{signal:listeners.signal});
document.querySelector('#retry')!.addEventListener('click',()=>{void reload();},{signal:listeners.signal});
window.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;if(e.code==='KeyL')chooseQuality('low');if(e.code==='KeyM')chooseQuality('medium');if(e.code==='KeyC')chooseView(view+1);},{signal:listeners.signal});
window.addEventListener('resize',()=>engine.resize(),{signal:listeners.signal});
const render=()=>{scene.render();frames++;if(environment){frameCosts.push(metrics.drawCallsCounter.current);if(frameCosts.length>30)frameCosts.shift();if(frames%20===0){const s=snapshot(),c=s.costs!;cost.textContent=`${views[view]!.name} · ${quality.toUpperCase()} · ${s.renderSize.join(' × ')}\n${c.triangles.toLocaleString()} scene triangles (before culling) · ${s.drawCalls} draw calls/frame · ${s.activeMeshes} active meshes\n${c.instances} repeated mesh instances · ${c.textures.length} asset/sign textures · ${(c.estimatedTextureBytes/1048576).toFixed(2)} MiB estimated RGBA+mips\n${c.shadowMapSize?`${c.shadowMapSize}² PCF shadow map`:'No dynamic shadow map'} · SwiftShader is not device-performance evidence`;}}};
engine.runRenderLoop(render);chooseView(0);chooseQuality('medium');
function shutdown(){unload();listeners.abort();engine.stopRenderLoop(render);metrics.dispose();scene.dispose();engine.dispose();}
Object.assign(window,{__streetPreview:{snapshot,chooseQuality,chooseView,reload,unload,shutdown}});
window.addEventListener('pagehide',shutdown,{once:true,signal:listeners.signal});
void reload();
