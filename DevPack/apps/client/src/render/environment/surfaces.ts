import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder.js";
import type { Material } from "@babylonjs/core/Materials/material.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { Vec3 } from "@stopthatguy/shared";

/** Flat-shaded original surfaces, all decorative and world-ID annotated. */
export function face(scene: Scene, name: string, points: readonly Vec3[], material: Material, repeat: [number, number] = [1, 1]): Mesh {
  if (points.length !== 3 && points.length !== 4) throw new Error("A surface must be a triangle or quad");
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = points.flatMap(p => [p.x,p.y,p.z]);
  data.indices = points.length === 3 ? [0,2,1] : [0,2,1,0,3,2];
  data.normals = [];
  VertexData.ComputeNormals(data.positions, data.indices, data.normals);
  data.uvs = points.length === 3 ? [0,0,repeat[0]/2,repeat[1],repeat[0],0] : [0,0,repeat[0],0,repeat[0],repeat[1],0,repeat[1]];
  data.applyToMesh(mesh);
  mesh.material = material; mesh.checkCollisions = false; mesh.isPickable = false; mesh.receiveShadows = true;
  return mesh;
}
export function ribbon(scene: Scene, name: string, a: Vec3, b: Vec3, width: number, material: Material, offset = 0, y = 0): Mesh {
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),rx=dz/length,rz=-dx/length;
  const v=(p:Vec3,side:number)=>({x:p.x+rx*(offset+side*width/2),y:p.y+y,z:p.z+rz*(offset+side*width/2)});
  return face(scene,name,[v(a,-1),v(b,-1),v(b,1),v(a,1)],material,[length/2,width/2]);
}
export function block(scene: Scene, name: string, position: Vec3, dimensions: Vec3, material: Material): Mesh {
  const mesh=CreateBox(name,{width:dimensions.x,height:dimensions.y,depth:dimensions.z},scene);
  mesh.position.set(position.x,position.y,position.z);mesh.material=material;mesh.receiveShadows=true;mesh.isPickable=false;mesh.checkCollisions=false;
  return mesh;
}
export function boundsOf(meshes: readonly Mesh[]) {
  let min: Vector3 | undefined,max: Vector3 | undefined;
  for(const mesh of meshes){mesh.computeWorldMatrix(true);const b=mesh.getBoundingInfo().boundingBox;min?min.minimizeInPlace(b.minimumWorld):min=b.minimumWorld.clone();max?max.maximizeInPlace(b.maximumWorld):max=b.maximumWorld.clone();}
  return {min:min?.asArray()??[],max:max?.asArray()??[]};
}
