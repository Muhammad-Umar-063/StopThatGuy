import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { VehicleType, Vec3 } from '@stopthatguy/shared';
import { loadVisualAsset, AssetLoadError } from '../assets/loadVisualAsset.js';
import { createContactShadow } from '../characters/contactShadow.js';
import { VEHICLE_DEFINITIONS, type VehicleDefinition, type VehicleQuality } from './definitions.js';

/** Presentation supplied by a caller; never an authoritative driving command. */
export interface VehiclePresentation {
  readonly position: Readonly<Vec3>;
  readonly yaw: number;
  readonly speedMps: number;
  readonly steeringRadians: number;
  readonly pitch?: number;
  readonly roll?: number;
  /** Optional absolute crank phase supplied by future animation presentation. */
  readonly pedalAngleRadians?: number;
}
export interface VehicleVisual {
  readonly type: VehicleType;
  readonly definition: VehicleDefinition;
  update(dtSeconds: number, input: VehiclePresentation, cameraDistanceM: number): void;
  setQuality(quality: VehicleQuality): void;
  /** Writes current world-space contact point, including steering/crank transforms. */
  anchorToRef(name: string, out: Vector3): void;
  /** Diagnostic allocation; keep out of production hot loops. */
  inspect(): { type: VehicleType; lod: number; triangles: number; residentTriangles: number; meshes: number; materials: number; imageTextures: number; bufferBytes: number; wheelAngles: number[]; anchors: Record<string, number[]>; bounds: {min:number[];max:number[]}; contactTriangles:number };
  dispose(): void;
}
const TAU = Math.PI * 2;
const wrap = (v:number) => ((v % TAU) + TAU) % TAU;
export async function loadVehicle(scene: Scene, type: VehicleType, options: { signal?: AbortSignal; quality?: VehicleQuality; baseUrl?: string; timeoutMs?: number } = {}): Promise<VehicleVisual> {
  if (!Object.hasOwn(VEHICLE_DEFINITIONS,type)) throw new RangeError('Unknown vehicle type');
  const definition = VEHICLE_DEFINITIONS[type];
  const asset = await loadVisualAsset(scene,definition.id,options);
  let shadow:Mesh|undefined, material:StandardMaterial|undefined;
  try {
    if(options.signal?.aborted) throw new AssetLoadError(asset.id,'cancelled','vehicle loading cancelled');
    if(scene.isDisposed) throw new AssetLoadError(asset.id,'scene','scene disposed while loading vehicle');
    const nodes=new Map<string,TransformNode>(asset.container.transformNodes.map(n=>[n.name,n]));
    for(const name of [...Object.keys(definition.pivots),...Object.keys(definition.anchors).map(n=>`anchor.${n}`)]) if(!nodes.has(name)) throw new Error(`Vehicle node missing: ${name}`);
    const lods=[0,1,2].map(i=>asset.container.meshes.filter(m=>m instanceof Mesh && m.name.endsWith(`:LOD${i}`)) as Mesh[]);
    if(lods.some(m=>m.length!==lods[0]!.length||m.length<4))throw new Error('Vehicle requires three complete articulated LODs');
    for(const group of lods)for(const mesh of group){mesh.checkCollisions=false;mesh.isPickable=false;mesh.receiveShadows=true;}
    const steering=definition.steering.map(name=>nodes.get(name)!),crank=definition.crank?nodes.get(definition.crank)!:null;
    const wheels=definition.wheels.map(w=>({node:nodes.get(w.pivot)!,radius:w.radiusM,angle:0}));
    for(const p of Object.keys(definition.pivots))nodes.get(p)!.rotationQuaternion=Quaternion.Identity();
    material=new StandardMaterial(`${type}:contact`,scene);material.diffuseColor=Color3.Black();material.specularColor=Color3.Black();material.disableLighting=true;material.disableDepthWrite=true;material.backFaceCulling=false;
    shadow=createContactShadow(`${type}:contact`,scene);shadow.material=material;shadow.parent=asset.root;shadow.position.y=.004;
    shadow.scaling.set(type==='lift'?1.9:.65,1,type==='lift'?4.3:2.5);
    let quality=options.quality??'medium',lod=-1,lastDistance=0,disposed=false;
    if(quality!=='low'&&quality!=='medium')throw new RangeError('Unsupported vehicle quality');
    function select(distance:number){
      const near=quality==='low'?0:12,far=quality==='low'?18:30;
      let next=distance<near?0:distance<far?1:2;
      if(lod===0&&quality==='medium'&&distance<near+1)next=0;
      if(lod===1&&distance>=near-1&&distance<far+1)next=1;
      if(lod===2&&distance>=far-1)next=2;
      if(quality==='low')next=Math.max(1,next);
      if(next!==lod){lod=next;for(let i=0;i<3;i++)for(const mesh of lods[i]!)mesh.setEnabled(i===lod);}
    }
    select(0);
    const contact=shadow,contactMaterial=material,scratch=new Vector3();
    const dispose=()=>{if(disposed)return;disposed=true;scene.onDisposeObservable.remove(observer);contact.dispose();contactMaterial.dispose();asset.dispose();};
    const observer=scene.onDisposeObservable.addOnce(dispose);
    const anchorToRef=(name:string,out:Vector3)=>{if(disposed)throw new Error('Vehicle disposed');const node=nodes.get(`anchor.${name}`);if(!node)throw new RangeError(`Unknown ${type} anchor: ${name}`);node.computeWorldMatrix(true);out.copyFrom(node.getAbsolutePosition());};
    return {type,definition,
      update(dt,input,distance){
        if(disposed)throw new Error('Vehicle disposed');
        const p=input.position,pitch=input.pitch??0,roll=input.roll??0,pedal=input.pedalAngleRadians??0;
        if(!Number.isFinite(dt)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)||!Number.isFinite(input.yaw)||!Number.isFinite(input.speedMps)||!Number.isFinite(input.steeringRadians)||!Number.isFinite(pitch)||!Number.isFinite(roll)||!Number.isFinite(pedal)||!Number.isFinite(distance)||dt<0||dt>.25||Math.abs(input.speedMps)>40||Math.abs(input.steeringRadians)>.6||Math.abs(pitch)>.6||Math.abs(roll)>.6||distance<0)throw new RangeError('Invalid vehicle presentation');
        asset.root.position.set(p.x,p.y,p.z);asset.root.rotation.set(pitch,input.yaw,roll);
        // Import retains the X-reflected glTF root: local yaw is the negative project yaw.
        for(const steer of steering)Quaternion.RotationYawPitchRollToRef(-input.steeringRadians,0,0,steer.rotationQuaternion!);
        for(const wheel of wheels){wheel.angle=wrap(wheel.angle+input.speedMps*dt/wheel.radius);Quaternion.RotationYawPitchRollToRef(0,wheel.angle,0,wheel.node.rotationQuaternion!);}
        if(crank)Quaternion.RotationYawPitchRollToRef(0,wrap(pedal),0,crank.rotationQuaternion!);
        lastDistance=distance;select(distance);
      },
      setQuality(value){if(disposed)throw new Error('Vehicle disposed');if(value!=='low'&&value!=='medium')throw new RangeError('Unsupported vehicle quality');quality=value;lod=-1;select(lastDistance);},anchorToRef,
      inspect(){
        if(disposed)throw new Error('Vehicle disposed');
        const anchors:Record<string,number[]>={};for(const name of Object.keys(definition.anchors)){anchorToRef(name,scratch);anchors[name]=scratch.asArray();}
        const min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity),buffers=new Set();let bufferBytes=0;
        for(const group of lods)for(const mesh of group){mesh.computeWorldMatrix(true);for(const kind of mesh.getVerticesDataKinds()){const buffer=mesh.getVertexBuffer(kind)?.getBuffer();if(buffer&&!buffers.has(buffer)){buffers.add(buffer);bufferBytes+=buffer.capacity;}}
          const index=mesh.geometry?.getIndexBuffer();if(index&&!buffers.has(index)){buffers.add(index);bufferBytes+=mesh.getTotalIndices()*(index.is32Bits?4:2);}}
        for(const mesh of lods[lod]!){const box=mesh.getBoundingInfo().boundingBox;min.minimizeInPlace(box.minimumWorld);max.maximizeInPlace(box.maximumWorld);}
        return {type,lod,triangles:lods[lod]!.reduce((s,m)=>s+m.getTotalIndices()/3,0),residentTriangles:lods.flat().reduce((s,m)=>s+m.getTotalIndices()/3,0),meshes:lods[lod]!.length,materials:asset.container.materials.length+1,imageTextures:asset.container.textures.length,bufferBytes,wheelAngles:wheels.map(w=>w.angle),anchors,bounds:{min:min.asArray(),max:max.asArray()},contactTriangles:contact.getTotalIndices()/3};
      },dispose};
  } catch(error){shadow?.dispose();material?.dispose();asset.dispose();throw error;}
}
