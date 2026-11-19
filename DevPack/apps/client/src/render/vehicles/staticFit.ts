// Review/test fixture only. T023 owns riding animation; this does not run in loadVehicle.
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import type { Character } from '../characters/character.js';
import type { VehicleVisual } from './vehicle.js';
import type { VehicleSeat } from './definitions.js';

function world(node: TransformNode) {
  node.computeWorldMatrix(true);
  return node.getAbsolutePosition().clone();
}
function aim(node: TransformNode, child: TransformNode, destination: Vector3) {
  const direction = destination.subtract(world(node));
  const inverse = Matrix.Invert((node.parent as TransformNode).computeWorldMatrix(true));
  const local = Vector3.TransformNormal(direction, inverse).normalize();
  Quaternion.FromUnitVectorsToRef(child.position.clone().normalize(), local, node.rotationQuaternion!);
  node.computeWorldMatrix(true);
}
function chain(a: TransformNode, b: TransformNode, c: TransformNode, target: Vector3, pole: Vector3) {
  const start = world(a), delta = target.subtract(start), reach = delta.length();
  const l1 = b.position.length(), l2 = c.position.length(), d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, reach));
  const direction = delta.normalize();
  const bend = pole.subtract(direction.scale(Vector3.Dot(pole, direction))).normalize();
  const along = (l1*l1 - l2*l2 + d*d)/(2*d);
  const knee = start.add(direction.scale(along)).add(bend.scale(Math.sqrt(Math.max(0,l1*l1-along*along))));
  aim(a,b,knee); aim(b,c,target);
  return { reach, available: l1+l2, errorM: Vector3.Distance(world(c),target) };
}

/** Neutral articulated mannequin fitted to the real imported T015 rig, not a riding clip. */
export function fitCharacter(character: Character, vehicle: VehicleVisual, seat: VehicleSeat, yaw: number, distance: number) {
  const contact = new Vector3(); vehicle.anchorToRef(seat.seat,contact);
  character.update(0,{position:{x:contact.x,y:contact.y+.12-.91,z:contact.z},yaw,speedMps:0,locomotion:'idle',turn:0},distance);
  const joints=character.animator.joints;
  for(const node of joints.values())node.rotationQuaternion=Quaternion.Identity();
  joints.get('hips')!.position.y=.91;
  for(const name of ['spine','chest'])Quaternion.RotationYawPitchRollToRef(0,seat.fitLeanRadians*(name==='spine'?1:.5),0,joints.get(name)!.rotationQuaternion!);
  const heading=Matrix.RotationY(yaw),forward=Vector3.TransformNormal(new Vector3(0,0,1),heading);
  const hands=[],feet=[];
  for(let i=0;i<2;i++){
    const side=i===0?'L':'R',hand=new Vector3(),foot=new Vector3();
    vehicle.anchorToRef(seat.hands[i]!,hand); vehicle.anchorToRef(seat.feet[i]!,foot);
    // Rig's wrist is 45 mm above palm contact; ankle is 82 mm above sole contact.
    hand.y+=.045; foot.y+=.082;
    const elbow=Vector3.TransformNormal(new Vector3(i===0?-.8:.8,-1,-.2),heading);
    const palm=joints.get(`hand.${side}`)!;
    const handFit=chain(joints.get(`upperArm.${side}`)!,joints.get(`forearm.${side}`)!,palm,hand,elbow);
    // Orient the actual local palm offset downward. A solved wrist alone does not
    // establish palm contact because the forearm rotates its child hand frame.
    const inverse=Matrix.Invert((palm.parent as TransformNode).computeWorldMatrix(true));
    Quaternion.FromUnitVectorsToRef(new Vector3(0,-1,0),Vector3.TransformNormal(new Vector3(0,-1,0),inverse).normalize(),palm.rotationQuaternion!);
    const palmContact=Vector3.TransformCoordinates(new Vector3(0,-.045,0),palm.computeWorldMatrix(true));
    hands.push({...handFit,errorM:Vector3.Distance(palmContact,hand.subtract(new Vector3(0,.045,0)))});
    const thigh=joints.get(`thigh.${side}`)!,shin=joints.get(`shin.${side}`)!,ankle=joints.get(`foot.${side}`)!;
    const footFit=chain(thigh,shin,ankle,foot,forward);
    ankle.rotationQuaternion=thigh.rotationQuaternion!.multiply(shin.rotationQuaternion!).conjugate();
    const soleContact=Vector3.TransformCoordinates(new Vector3(0,-.082,0),ankle.computeWorldMatrix(true));
    feet.push({...footFit,errorM:Vector3.Distance(soleContact,foot.subtract(new Vector3(0,.082,0)))});
  }
  return {seat:seat.id,identity:character.identity,seatErrorM:Vector3.Distance(world(joints.get('hips')!).subtract(new Vector3(0,.12,0)),contact),hands,feet};
}
