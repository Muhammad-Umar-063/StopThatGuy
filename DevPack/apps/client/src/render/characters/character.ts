import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import {createContactShadow} from './contactShadow.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { loadVisualAsset, AssetLoadError } from '../assets/loadVisualAsset.js';
import { CharacterAnimator, type CharacterPresentation } from './animation.js';

export type CharacterIdentity='player'|'robber';
export type CharacterQuality='low'|'medium';
export interface Character {
  readonly identity:CharacterIdentity;
  readonly animator:CharacterAnimator;
  update(dtSeconds:number,input:CharacterPresentation,cameraDistanceM:number):void;
  setQuality(quality:CharacterQuality):void;
  /** Explicit snapshot allocation for tools/HUD, never called in the animation hot path. */
  inspect(): { identity:CharacterIdentity; lod:number; triangles:number; residentTriangles:number; materials:number; imageTextures:number; bonePaletteTextures:number; bonePaletteBytes:number; contactTriangles:number; skeletons:number; joints:number; vertexAndIndexBytes:number; phase:number; weights:number[]; turn:number; feet:number[][]; position:number[] };
  dispose():void;
}
/** Owns one GLB load and its skeletons, LODs, clips, materials, shadow and listener.
 * Caller advances it from presentation data. It never reads sockets/simulation or changes collision.
 */
export async function loadCharacter(scene:Scene,identity:CharacterIdentity,options:{signal?:AbortSignal;quality?:CharacterQuality;baseUrl?:string;timeoutMs?:number}={}):Promise<Character>{
  const asset=await loadVisualAsset(scene,identity==='player'?'character.player':'character.robber',options);
  let animator:CharacterAnimator|undefined,shadow:Mesh|undefined,shadowMaterial:StandardMaterial|undefined;
  try{
    // Cancellation can arrive in a microtask after the shared asset promise resolves.
    if(options.signal?.aborted)throw new AssetLoadError(asset.id,'cancelled','character loading cancelled');
    if(scene.isDisposed)throw new AssetLoadError(asset.id,'scene','scene disposed while loading character');
    const meshes=[0,1,2].map(l=>asset.container.meshes.find(m=>m.name===`${identity}:LOD${l}`));
    if(meshes.some(m=>!(m instanceof Mesh)||!m.skeleton)||asset.container.skeletons.length!==1)throw new Error('Character requires three skinned LOD meshes sharing one skeleton');
    const lods=meshes as Mesh[];
    animator=new CharacterAnimator(asset.container.animationGroups);
    for(const m of lods){m.receiveShadows=true;m.checkCollisions=false;m.isPickable=false;m.setBoundingInfo(new BoundingInfo(new Vector3(-1,-.1,-1),new Vector3(1,2,1)));}
    shadowMaterial=new StandardMaterial(`${identity}:contact`,scene);shadowMaterial.diffuseColor=Color3.Black();shadowMaterial.specularColor=Color3.Black();shadowMaterial.alpha=1;shadowMaterial.backFaceCulling=false;shadowMaterial.disableLighting=true;shadowMaterial.disableDepthWrite=true;
    shadow=createContactShadow(`${identity}:contact`,scene);shadow.material=shadowMaterial;shadow.parent=asset.root;shadow.position.y=.003;shadow.isPickable=false;
    let quality=options.quality??'medium',lod=-1,disposed=false,lastDistance=0;
    function select(distance:number){
      const near=quality==='low'?0:9,far=quality==='low'?15:24;
      let next=distance<near?0:distance<far?1:2;
      // A 1 m band around distance boundaries avoids flip-flopping as a camera settles.
      if(lod===0&&quality==='medium'&&distance<near+1)next=0;
      if(lod===1&&distance>=near-1&&distance<far+1)next=1;
      if(lod===2&&distance>=far-1)next=2;
      if(quality==='low')next=Math.max(1,next);
      if(next!==lod){lod=next;lods.forEach((m,i)=>m.setEnabled(i===lod));}
    }
    select(0);
    const rig=animator,contact=shadow,material=shadowMaterial;
    const dispose=()=>{if(disposed)return;disposed=true;scene.onDisposeObservable.remove(observer);rig.dispose();contact.dispose();material.dispose();asset.dispose();};
    const observer=scene.onDisposeObservable.addOnce(dispose);
    return {identity,animator:rig,
      update(dt,input,distance){
        if(disposed)throw new Error('Character disposed');
        const p=input.position,slope=input.slope??0;
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||!Number.isFinite(input.yaw)||!Number.isFinite(slope)||Math.abs(slope)>.6||!Number.isFinite(distance)||distance<0)throw new RangeError('Invalid character transform/distance');
        rig.update(dt,input);asset.root.position.set(p.x,p.y,p.z);asset.root.rotation.set(-slope,input.yaw,0);lastDistance=distance;select(distance);
      },
      setQuality(value){if(disposed)throw new Error('Character disposed');if(value!=='low'&&value!=='medium')throw new RangeError('Unsupported character quality');quality=value;lod=-1;select(lastDistance);},
      inspect(){
        if(disposed)throw new Error('Character disposed');
        asset.root.computeWorldMatrix(true);const feet=['foot.L','foot.R'].map(name=>{const n=rig.joints.get(name)!;n.computeWorldMatrix(true);return n.getAbsolutePosition().asArray();});
        const palettes=new Set(lods.map(m=>m.skeleton!.getTransformMatrixTexture(m)).filter(t=>t!=null));
        // Native buffer capacities avoid counting temporary Float32 conversions of joint indices.
        const buffers=new Set(lods.flatMap(m=>m.getVerticesDataKinds().map(k=>m.getVertexBuffer(k)?.getBuffer())).filter(b=>b!=null));
        let vertexAndIndexBytes=[...buffers].reduce((n,b)=>n+b.capacity,0);
        // Babylon 9.37 tracks native index width but leaves index-buffer capacity at zero.
        for(const mesh of lods){const index=mesh.geometry?.getIndexBuffer();if(index&&!buffers.has(index)){buffers.add(index);vertexAndIndexBytes+=mesh.getTotalIndices()*(index.is32Bits?4:2);}}
        return {identity,lod,triangles:lods[lod]!.getTotalIndices()/3,residentTriangles:lods.reduce((n,m)=>n+m.getTotalIndices()/3,0),materials:asset.container.materials.length+1,imageTextures:asset.container.textures.length,bonePaletteTextures:palettes.size,bonePaletteBytes:[...palettes].reduce((n,t)=>n+t!.getSize().width*t!.getSize().height*16,0),contactTriangles:contact.getTotalIndices()/3,skeletons:asset.container.skeletons.length,joints:asset.container.skeletons[0]!.bones.length,
          vertexAndIndexBytes,phase:rig.phase,weights:Array.from(rig.weights),turn:rig.turnWeight,feet,position:asset.root.position.asArray()};
      },dispose};
  }catch(error){animator?.dispose();shadow?.dispose();shadowMaterial?.dispose();asset.dispose();throw error;}
}
