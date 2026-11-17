import "@babylonjs/core/Meshes/thinInstanceMesh.js";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { Scene } from "@babylonjs/core/scene.js";
import type { AssetContainer } from "@babylonjs/core/assetContainer.js";
import type { Material } from "@babylonjs/core/Materials/material.js";
import type { WorldData, Vec3 } from "@stopthatguy/shared";
import { streetPlan, streetGround, QUALITY, type StreetQuality } from "./layout.js";
import { block, face, ribbon } from "./surfaces.js";

interface Placement { position: Vec3; yaw: number; scale: Vec3; worldId: string; mediumOnly?: boolean }
export interface StreetEnvironment {
  readonly worldVersion: string;
  readonly anchorIds: readonly string[];
  readonly meshes: readonly Mesh[];
  readonly instances: ReadonlyMap<string, readonly Placement[]>;
  setQuality(quality: StreetQuality): void;
  costs(): {quality:StreetQuality; meshes:number; instances:number; triangles:number; materials:number; textures:{name:string;width:number;height:number}[]; estimatedTextureBytes:number; shadowMapSize:number};
  dispose(): void;
}

/** Builds visual geometry using committed anchors. The caller owns/disposes the lazy-loaded kit. */
export function createStreetEnvironment(scene: Scene, world: WorldData, kit: AssetContainer, initialQuality: StreetQuality): StreetEnvironment {
  const plan = streetPlan(world);
  if (scene.useRightHandedSystem) throw new Error("Street requires the project's left-handed scene");
  const meshes:Mesh[]=[],ownedMaterials:Material[]=[],ownedTextures:DynamicTexture[]=[];
  const instances=new Map<string,Placement[]>();
  const anchorIds=new Set<string>();
  const templates=kit.meshes.filter((m):m is Mesh=>m instanceof Mesh && m.getTotalVertices()>0);
  for(const mesh of templates){mesh.isVisible=false;mesh.checkCollisions=false;mesh.isPickable=false;}
  const material=(name:string)=>{const m=kit.materials.find(m=>m.name===`kit/${name}`);if(!m)throw new Error(`Kit material missing: ${name}`);return m as PBRMaterial;};
  // Tile and matte surfaces share the original kit textures; no downloads/dynamic decoders.
  const stone=material('stone'),roof=material('roof'),asphalt=material('asphalt'),paving=material('paving'),tile=material('tile');
  const paintColors=['#e9d8ad','#cfa7a0','#a6c1be','#e5c383','#e2ddd0'];
  const paints=paintColors.map((color,i)=>{
    // Material.clone also clones textures; sharing the kit texture avoids duplicate GPU
    // allocations and orphaned clones when a quality preview is reloaded.
    const template=material('plaster'),m=new PBRMaterial(`plaster-${i}`,scene);
    m.albedoTexture=template.albedoTexture;m.metallic=template.metallic;m.roughness=template.roughness;
    m.backFaceCulling=template.backFaceCulling;m.sideOrientation=template.sideOrientation;
    m.albedoColor=Color3.FromHexString(color);ownedMaterials.push(m);return m;
  });
  const add=(mesh:Mesh,id:string)=>{mesh.metadata={worldId:id,visualOnly:true,artStatus:'final-direction'};anchorIds.add(id);meshes.push(mesh);return mesh;};
  const place=(prototype:string,worldId:string,x:number,y:number,z:number,yaw=0,sx=1,sy=1,sz=1,mediumOnly=false)=>{
    const list=instances.get(prototype)??[];list.push({position:{x,y,z},yaw,scale:{x:sx,y:sy,z:sz},worldId,mediumOnly});instances.set(prototype,list);anchorIds.add(worldId);
  };
  const v=(x:number,y:number,z:number):Vec3=>({x,y,z});
  // A noncolliding visual skirt closes the empty space around this street slice.
  // Its grade comes from the road anchors; it never declares additional walkable routes.
  const roadSegments=plan.surfaces.filter(s=>s.kind==='road');
  const first=roadSegments[0]!,last=roadSegments.at(-1)!;
  const skirtCuts=[first.a.z-20,...roadSegments.map(s=>s.a.z),last.b.z,last.b.z+20];
  for(let i=1;i<skirtCuts.length;i++){
    const za=skirtCuts[i-1]!,zb=skirtCuts[i]!;
    if(za===zb)continue;
    const ya=streetGround(za,world)-.035,yb=streetGround(zb,world)-.035;
    add(face(scene,`n-square:surface:skirt:${i}`,[v(-70,ya,za),v(-70,yb,zb),v(70,yb,zb),v(70,ya,za)],stone,[70,(zb-za)/2]),'n-square');
  }
  // Ground and footpath surfaces come directly from centreline endpoints and grades.
  for(const s of plan.surfaces){
    const groundMaterial=s.kind==='road'?asphalt:paving;
    add(ribbon(scene,`${s.edgeId}:surface`,s.a,s.b,s.widthM,groundMaterial),s.edgeId);
    if(s.kind==='road'){
      const pieces=s.edgeId==='e-main-n1'?[{a:s.a,b:{...s.b,z:58.3}}]:s.edgeId==='e-main-n2'?[{a:{...s.a,z:61.7,y:streetGround(61.7,world)},b:s.b}]:[{a:s.a,b:s.b}];
      for(const side of [-1,1])for(const piece of (side===-1?pieces:[{a:s.a,b:s.b}])){
        add(ribbon(scene,`${s.edgeId}:pavement:${side}`,piece.a,piece.b,2.5,paving,side*5.75,.11),s.edgeId);
        add(ribbon(scene,`${s.edgeId}:curb:${side}`,piece.a,piece.b,.18,stone,side*4.5,.12),s.edgeId);
      }
    }
    // 0.25 m risers stay within the world's 0.3 m presentation tolerance.
    if(s.kind==='foot'&&s.b.y>s.a.y){const steps=Math.ceil((s.b.y-s.a.y)/.25);for(let i=0;i<steps;i++){
      const t0=i/steps,t1=(i+1)/steps;const y=s.a.y+(s.b.y-s.a.y)*t1;
      const a=v(s.a.x+(s.b.x-s.a.x)*t0,y,s.a.z+(s.b.z-s.a.z)*t0),b=v(s.a.x+(s.b.x-s.a.x)*t1,y,s.a.z+(s.b.z-s.a.z)*t1);
      add(ribbon(scene,`${s.edgeId}:tread:${i}`,a,b,s.widthM,stone,0,.015),s.edgeId);
    }}
  }
  add(face(scene,'n-square:forecourt',[v(-7,0,-8),v(-7,0,0),v(7,0,0),v(7,0,-8)],paving,[4,7]),'n-square');
  // One physically coherent shell per collider; adjacent facade bays supply variation.
  for(const [bi,b] of plan.buildings.entries()){
    const {center:c,halfExtents:h}=b; const id=b.id;
    add(block(scene,`${id}:shell`,c,v(h.x*2,h.y*2,h.z*2),paints[bi%paints.length]!),id);
    const alley=id==='c-alley-house';const west=c.x<0&&!alley;
    const front=alley?c.z-h.z:west?c.x+h.x:c.x-h.x;
    const yaw=alley?Math.PI:west?Math.PI/2:-Math.PI/2;
    const length=alley?h.x*2:h.z*2,along=alley?c.x:c.z,start=along-length/2;
    const bays=Math.max(1,Math.round(length/5.5)),pitch=length/bays;
    const top=c.y+h.y,base=c.y-h.y;
    for(let i=0;i<bays;i++){
      const at=start+(i+.5)*pitch;const ground=alley?0:streetGround(at,world);
      const x=alley?at:front+(west?.25:-.25),z=alley?front-.25:at;
      // Ground-level tile dado, framed portals, and three upper-floor window rhythms.
      const panel=alley?block(scene,`${id}:tile:${i}`,v(x,ground+.85,z-.01),v(pitch,.95,.06),tile)
        :block(scene,`${id}:tile:${i}`,v(x,ground+.85,z),v(.06,.95,pitch),tile);
      add(panel,id);
      place('portal',id,x,ground,z,yaw,.88,.88,1);
      const floors=alley?1:3;
      for(let floor=0;floor<floors;floor++){
        const y=ground+3.75+floor*2.65;
        if(y+2.25>top-.25)continue;
        place('window',id,x,y,z,yaw);
        if((i+floor)%2===0){place('balcony',id,x,y-.12,z,yaw);place('balcony-detail',id,x,y-.12,z,yaw,1,1,1,true);
          if(i%3===1)place('flowerbox',id,x,y+.05,z,yaw,1,1,1,true);}
      }
      place('cornice',id,x,top-.18,z,yaw,pitch,1,1);
      place('cornice',id,x,ground+3.35,z,yaw,pitch,.55,.6);
    }
    // Continuous pitched terracotta roofs and pale end gables, no collision mutation.
    const eave=top+.22,ridge=top+2;
    if(!alley){
      add(face(scene,`${id}:roof-west`,[v(c.x-h.x-.25,eave,c.z-h.z-.25),v(c.x,eave+1.78,c.z-h.z-.25),v(c.x,ridge,c.z+h.z+.25),v(c.x-h.x-.25,eave,c.z+h.z+.25)].reverse(),roof,[h.x*1.2,h.z*2]),id);
      add(face(scene,`${id}:roof-east`,[v(c.x,ridge,c.z-h.z-.25),v(c.x+h.x+.25,eave,c.z-h.z-.25),v(c.x+h.x+.25,eave,c.z+h.z+.25),v(c.x,ridge,c.z+h.z+.25)].reverse(),roof,[h.x*1.2,h.z*2]),id);
    }else{
      add(face(scene,`${id}:roof-front`,[v(c.x-h.x-.2,eave,c.z-h.z-.2),v(c.x+h.x+.2,eave,c.z-h.z-.2),v(c.x+h.x+.2,ridge,c.z),v(c.x-h.x-.2,ridge,c.z)].reverse(),roof,[h.x*2,h.z]),id);
      add(face(scene,`${id}:roof-back`,[v(c.x-h.x-.2,ridge,c.z),v(c.x+h.x+.2,ridge,c.z),v(c.x+h.x+.2,eave,c.z+h.z+.2),v(c.x-h.x-.2,eave,c.z+h.z+.2)].reverse(),roof,[h.x*2,h.z]),id);
    }
    add(block(scene,`${id}:eave-base`,v(c.x,top+.11,c.z),v(h.x*2,.22,h.z*2),paints[bi%paints.length]!),id);
    // Close the roof ends so low chase views never see sky through the attic.
    for(const side of [-1,1]){
      const gable=alley
        ? [v(c.x+side*h.x,eave,c.z-h.z),v(c.x+side*h.x,ridge,c.z),v(c.x+side*h.x,eave,c.z+h.z)]
        : [v(c.x-h.x,eave,c.z+side*h.z),v(c.x,ridge,c.z+side*h.z),v(c.x+h.x,eave,c.z+side*h.z)];
      if((alley&&side<0)||(!alley&&side>0))gable.reverse();
      add(face(scene,`${id}:gable:${side}`,gable,paints[bi%paints.length]!),id);
    }
    // Modest chimneys add roof silhouette without extending the gameplay footprint.
    add(block(scene,`${id}:chimney`,v(c.x+2,top+1.7,c.z),v(.7,1.9,.9),stone),id);
    void base;
  }
  // Furniture fits the committed stand/lamp anchors; no additional road obstacles.
  for(let i=0;i<4;i++)place('rack',plan.rack.id,plan.rack.center.x,0,plan.rack.center.z-2.1+i*1.4);
  place('lamp',plan.lamp.id,plan.lamp.center.x,plan.lamp.center.y-plan.lamp.heightM/2,plan.lamp.center.z);
  // Fictional shop/bank signage, drawn locally with a system font (no font binary).
  function sign(id:string,text:string,x:number,y:number,z:number,yaw:number,w:number){
    const tex=new DynamicTexture(`sign:${text}`,{width:512,height:128},scene,false);
    const ctx=tex.getContext();ctx.fillStyle='#193e43';ctx.fillRect(0,0,512,128);ctx.strokeStyle='#e7d8ae';ctx.lineWidth=4;ctx.strokeRect(10,10,492,108);
    ctx.fillStyle='#f6ecd0';ctx.font='600 33px serif';ctx.fillText(text,(512-ctx.measureText(text).width)/2,78);
    // The street-facing local +Z face maps canvas text right-to-left without this UV reflection.
    tex.uScale=-1;tex.uOffset=1;tex.update();ownedTextures.push(tex);const m=new StandardMaterial(`sign:${id}`,scene);m.diffuseTexture=tex;m.specularColor=Color3.Black();ownedMaterials.push(m);
    const mesh=face(scene,`sign:${text}`,[v(-w/2,-.35,0),v(w/2,-.35,0),v(w/2,.35,0),v(-w/2,.35,0)],m);mesh.rotation.y=yaw;mesh.position.set(x,y,z);add(mesh,id);
  }
  sign('c-bank','BANCO DO LARGO',-6.8,3.02,15,Math.PI/2,6.2);
  sign('c-block-east-south','CAFÉ AURORA',6.8,3.02,22,-Math.PI/2,4.6);
  sign('c-alley-house','TRAVESSA DO ARCO',-23,3.15,62.8,Math.PI,4.1);
  // Batch static meshes by shared material and shadow role. Stable anchor IDs stay
  // in metadata, while architectural detail does not require one draw per wall.
  const batches=new Map<string,Mesh[]>();
  for(const mesh of meshes){
    const ground=/:surface|:pavement|:curb|:tread|:forecourt/.test(mesh.name);
    const key=`${ground?'ground':'architecture'}:${mesh.material!.uniqueId}`;
    const list=batches.get(key)??[];list.push(mesh);batches.set(key,list);
  }
  meshes.length=0;
  for(const [key,list] of batches){
    const worldIds=[...new Set(list.map(m=>m.metadata.worldId as string))];
    const merged=list.length===1?list[0]!:Mesh.MergeMeshes(list,true,true,undefined,false,false);
    if(!merged)throw new Error(`Could not batch street geometry: ${key}`);
    merged.name=`street:${key}`;merged.receiveShadows=true;merged.isPickable=false;merged.checkCollisions=false;
    merged.metadata={worldIds,visualOnly:true,artStatus:'final-direction',castsShadow:!key.startsWith('ground')};
    meshes.push(merged);
  }
  const previous={clear:scene.clearColor.clone(),fogMode:scene.fogMode,fogColor:scene.fogColor.clone(),fogStart:scene.fogStart,fogEnd:scene.fogEnd};
  scene.clearColor=new Color4(.72,.82,.84,1);scene.fogMode=Scene.FOGMODE_LINEAR;scene.fogColor=new Color3(.72,.82,.84);scene.fogStart=65;scene.fogEnd=150;
  const fill=new HemisphericLight('street:sky',new Vector3(0,1,0),scene);fill.intensity=.72;fill.diffuse=new Color3(.85,.91,1);fill.groundColor=new Color3(.39,.32,.25);
  const sun=new DirectionalLight('street:afternoon',new Vector3(-.65,-1,.45).normalize(),scene);sun.position.set(30,55,5);sun.intensity=2.3;sun.diffuse=new Color3(1,.88,.70);sun.shadowMinZ=1;sun.shadowMaxZ=160;
  let shadows:ShadowGenerator|undefined,quality:StreetQuality=initialQuality,disposed=false;
  function setQuality(next:StreetQuality){
    if(disposed)throw new Error('Street has been disposed');quality=next;
    for(const mesh of templates){const prototype=mesh.name.split('/')[0]!;const list=(instances.get(prototype)??[]).filter(p=>next==='medium'||!p.mediumOnly);
      mesh.isVisible=list.length>0;mesh.receiveShadows=true;
      if(!list.length){mesh.thinInstanceCount=0;continue;}
      const original=mesh.computeWorldMatrix(true).clone(),inverse=Matrix.Invert(original);
      const matrices=list.flatMap(p=>Array.from(original.multiply(Matrix.Compose(new Vector3(p.scale.x,p.scale.y,p.scale.z),Quaternion.RotationAxis(Vector3.Up(),p.yaw),new Vector3(p.position.x,p.position.y,p.position.z))).multiply(inverse).m));
      mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices),16,true);mesh.thinInstanceRefreshBoundingInfo(true);
      mesh.metadata={visualOnly:true,worldIds:[...new Set(list.map(p=>p.worldId))],prototype};
    }
    shadows?.dispose();shadows=undefined;
    if(QUALITY[next].shadows){shadows=new ShadowGenerator(1024,sun);shadows.usePercentageCloserFiltering=true;shadows.filteringQuality=ShadowGenerator.QUALITY_LOW;shadows.bias=.002;shadows.normalBias=.03;
      // Static architecture and repeated details only; no moving actors in this slice.
      for(const mesh of [...meshes,...templates])if(mesh.isVisible&&mesh.metadata?.castsShadow!==false)shadows.addShadowCaster(mesh,false);
    }
  }
  setQuality(initialQuality);
  function costs(){const rendered=templates.filter(m=>m.isVisible);const textures=[...kit.textures,...ownedTextures].map(t=>({name:t.name,width:t.getSize().width,height:t.getSize().height}));
    return{quality,meshes:meshes.length+rendered.length,instances:rendered.reduce((n,m)=>n+m.thinInstanceCount,0),triangles:meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0)+rendered.reduce((n,m)=>n+m.getTotalIndices()/3*m.thinInstanceCount,0),materials:new Set([...meshes,...rendered].map(m=>m.material)).size,textures,
      estimatedTextureBytes:textures.reduce((n,t)=>n+t.width*t.height*4*(t.height===128?1:4/3),0),shadowMapSize:shadows?1024:0};}
  const dispose=()=>{if(disposed)return;disposed=true;scene.onDisposeObservable.remove(observer);shadows?.dispose();fill.dispose();sun.dispose();for(const m of meshes)m.dispose();for(const m of ownedMaterials)m.dispose();for(const t of ownedTextures)t.dispose();for(const m of templates){m.isVisible=false;m.thinInstanceSetBuffer('matrix',null);}
    if(!scene.isDisposed){scene.clearColor=previous.clear;scene.fogMode=previous.fogMode;scene.fogColor=previous.fogColor;scene.fogStart=previous.fogStart;scene.fogEnd=previous.fogEnd;}};
  const observer=scene.onDisposeObservable.addOnce(dispose);
  return{worldVersion:plan.worldVersion,anchorIds:[...anchorIds],meshes,instances,setQuality,costs,dispose};
}
