import {Mesh} from '@babylonjs/core/Meshes/mesh.js';
import {VertexData} from '@babylonjs/core/Meshes/mesh.vertexData.js';
import type {Scene} from '@babylonjs/core/scene.js';
/** Feathered contact shadow without an image, extra render pass or dynamic shadow map. */
export function createContactShadow(name:string,scene:Scene):Mesh {
  const mesh=new Mesh(name,scene),data=new VertexData(),segments=24;
  data.positions=[0,0,0];data.normals=[0,1,0];data.colors=[0,0,0,.22];data.indices=[];
  for(const [radius,alpha] of [[.13,.18],[.27,.09],[.42,0]])for(let i=0;i<segments;i++){
    const a=i/segments*Math.PI*2;data.positions.push(Math.cos(a)*radius!,0,Math.sin(a)*radius!*.8);data.normals.push(0,1,0);data.colors.push(0,0,0,alpha!);
  }
  for(let i=0;i<segments;i++){const a=1+i,b=1+(i+1)%segments;data.indices.push(0,a,b);for(let ring=0;ring<2;ring++){const x=a+ring*segments,y=b+ring*segments;data.indices.push(x,x+segments,y,y,x+segments,y+segments);}}
  data.applyToMesh(mesh);mesh.hasVertexAlpha=true;mesh.isPickable=false;return mesh;
}
