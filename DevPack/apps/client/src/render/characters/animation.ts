import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

export type Locomotion = 'idle' | 'run' | 'sprint';
/** Renderer input only; caller supplies actual motion, never a network intent. */
export interface CharacterPresentation {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly yaw: number;
  readonly speedMps: number;
  readonly locomotion: Locomotion;
  /** Signed normalized turn effort: -1 left, +1 right. */
  readonly turn: number;
  /** Optional local route slope in radians; visual approximation, not collision. */
  readonly slope?: number;
}
export const CLIP_MAPPING = Object.freeze({idle:'idle',run:'run',sprint:'sprint',left:'turnLeft',right:'turnRight'});
const names = ['idle','run','sprint','turnLeft','turnRight'] as const;
type ClipName = typeof names[number];
interface Track { node:TransformNode; property:'rotationQuaternion'|'position'; frames:Float32Array; values:Float32Array; size:3|4 }
interface Clip { duration:number; tracks:Track[] }
const smooth = (v:number) => {const x=Math.min(1,Math.max(0,v));return x*x*(3-2*x);};

/** Uses the imported, skinned GLB's real clips; no engine-clock animatables or frame allocations.
 * All base clips share a gait phase. Cadence follows actual speed / blended stride.
 * Turn clips are additive upper-body balance, preserving lower-body contact phase.
 */
export class CharacterAnimator {
  readonly joints: ReadonlyMap<string,TransformNode>;
  readonly weights = new Float64Array([1,0,0]);
  phase=0;
  turnWeight=0;
  private idlePhase=0;
  private readonly clips:Record<ClipName,Clip>;
  private readonly q=new Quaternion();
  private readonly a=new Quaternion();
  private readonly b=new Quaternion();
  private readonly v=new Vector3();
  private readonly sum=new Vector3();
  private readonly identity=Quaternion.Identity();
  private readonly baseNodes:TransformNode[];
  private readonly nodeIndex=new Map<TransformNode,number>();
  private readonly rotations:Quaternion[];
  private disposed=false;
  constructor(groups:readonly AnimationGroup[]) {
    const jointMap=new Map<string,TransformNode>(),clips={} as Record<ClipName,Clip>;
    for(const name of names){
      const group=groups.find(g=>g.name===name);if(!group)throw new Error(`Character clip missing: ${name}`);group.stop();
      const tracks:Track[]=[];
      for(const {target,animation} of group.targetedAnimations){
        const property=animation.targetProperty;
        if(property!=='position'&&property!=='rotationQuaternion')throw new Error(`Unsupported character track: ${property}`);
        const node=target as TransformNode,size=property==='position'?3:4,keys=animation.getKeys();
        if(!keys||keys.length<2)throw new Error(`Empty character track: ${name}/${node.name}`);
        const frames=new Float32Array(keys.length),values=new Float32Array(keys.length*size);
        keys.forEach((key,i)=>{frames[i]=key.frame/animation.framePerSecond;key.value.toArray(values,i*size);});
        jointMap.set(node.name,node);tracks.push({node,property,frames,values,size});
      }
      clips[name]={duration:tracks[0]!.frames.at(-1)!,tracks};
    }
    if(jointMap.size!==17||!jointMap.has('hips')||!jointMap.has('foot.L')||!jointMap.has('foot.R'))throw new Error('Expected the STG 17-joint humanoid rig');
    this.clips=clips;this.joints=jointMap;this.baseNodes=[...jointMap.values()];
    this.rotations=this.baseNodes.map(()=>Quaternion.Identity());
    this.baseNodes.forEach((n,i)=>{this.nodeIndex.set(n,i);n.rotationQuaternion??=Quaternion.Identity();});
    this.apply();
  }
  private sample(track:Track,phase:number){
    const t=phase*track.frames.at(-1)!,count=track.frames.length;
    let lo=0,hi=count-1;while(hi-lo>1){const m=(lo+hi)>>1;if(track.frames[m]!>t)hi=m;else lo=m;}
    const f=(t-track.frames[lo]!)/(track.frames[hi]!-track.frames[lo]!),o=lo*track.size,p=hi*track.size;
    if(track.size===4){Quaternion.FromArrayToRef(track.values,o,this.a);Quaternion.FromArrayToRef(track.values,p,this.b);Quaternion.SlerpToRef(this.a,this.b,f,this.q);}
    else this.v.set(track.values[o]!+(track.values[p]!-track.values[o]!)*f,track.values[o+1]!+(track.values[p+1]!-track.values[o+1]!)*f,track.values[o+2]!+(track.values[p+2]!-track.values[o+2]!)*f);
  }
  update(dt:number,input:CharacterPresentation){
    if(this.disposed)throw new Error('Character animator disposed');
    if(!Number.isFinite(dt)||dt<0||dt>.25)throw new RangeError('Presentation delta must be 0..0.25 seconds; callers clamp frame stalls');
    if(!Number.isFinite(input.speedMps)||input.speedMps<0||input.speedMps>30||!Number.isFinite(input.turn)||Math.abs(input.turn)>1||(input.locomotion!=='idle'&&input.locomotion!=='run'&&input.locomotion!=='sprint'))throw new RangeError('Invalid locomotion presentation');
    // Speed remains authoritative for cadence even when a held sprint intent is blocked.
    const moving=smooth(input.speedMps/.8),sprint=input.locomotion==='sprint'?smooth((input.speedMps-4)/3):0,blend=1-Math.exp(-dt/0.10);
    this.weights[0]=this.weights[0]!+(1-moving-this.weights[0]!)*blend;
    this.weights[2]=this.weights[2]!+(moving*sprint-this.weights[2]!)*blend;
    this.weights[1]=1-this.weights[0]!-this.weights[2]!;
    this.turnWeight+=(input.turn-this.turnWeight)*blend;
    const stride=this.weights[1]!*2.4+this.weights[2]!*3.2;
    // At rest freeze foot phase; idle breath continues. Acceleration crosses fade smoothly.
    if(input.speedMps>.001&&stride>.01)this.phase=(this.phase+dt*Math.min(4,input.speedMps/stride))%1;
    this.idlePhase=(this.idlePhase+dt/this.clips.idle.duration)%1;
    this.apply();
  }
  private apply(){
    for(let i=0;i<this.baseNodes.length;i++)this.rotations[i]!.set(0,0,0,0);
    this.sum.setAll(0);
    for(let c=0;c<3;c++){
      const w=this.weights[c]!;if(w<1e-8)continue;
      for(const track of this.clips[names[c]!].tracks){
        this.sample(track,c===0?this.idlePhase:this.phase);const index=this.nodeIndex.get(track.node)!;
        if(track.size===4){const out=this.rotations[index]!,sign=this.q.w<0?-w:w;out.x+=this.q.x*sign;out.y+=this.q.y*sign;out.z+=this.q.z*sign;out.w+=this.q.w*sign;}
        else {this.sum.x+=this.v.x*w;this.sum.y+=this.v.y*w;this.sum.z+=this.v.z*w;}
      }
    }
    for(let i=0;i<this.baseNodes.length;i++)this.baseNodes[i]!.rotationQuaternion!.copyFrom(this.rotations[i]!.normalize());
    this.joints.get('hips')!.position.copyFrom(this.sum);
    // Quaternion blends can extend the legs below a linearly blended hip height.
    // Correct only penetration; preserve the authored airborne part of each gait.
    let lowest=Infinity;
    for(let side=0;side<2;side++){
      const thigh=this.joints.get(side===0?'thigh.L':'thigh.R')!.rotationQuaternion!;
      const shin=this.joints.get(side===0?'shin.L':'shin.R')!.rotationQuaternion!;
      thigh.multiplyToRef(shin,this.b);
      const y=this.sum.y-.405*(1-2*(thigh.x*thigh.x+thigh.z*thigh.z))-.42*(1-2*(this.b.x*this.b.x+this.b.z*this.b.z));
      lowest=Math.min(lowest,y);
    }
    if(lowest<.085)this.joints.get('hips')!.position.y+=.085-lowest;

    const amount=Math.abs(this.turnWeight);
    if(amount>.001)for(const track of this.clips[this.turnWeight<0?'turnLeft':'turnRight'].tracks){
      if(track.size!==4)continue;this.sample(track,this.phase);
      Quaternion.SlerpToRef(this.identity,this.q,amount,this.a);
      track.node.rotationQuaternion!.multiplyToRef(this.a,track.node.rotationQuaternion!);
    }
  }
  dispose(){this.disposed=true;}
}
