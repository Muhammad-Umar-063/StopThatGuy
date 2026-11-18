export const bones=[
 ['hips',-1,[0,.91,0]],['spine',0,[0,1.09,0]],['chest',1,[0,1.34,0]],['neck',2,[0,1.51,0]],['head',3,[0,1.60,0]],
 ['upperArm.R',2,[.205,1.425,0]],['forearm.R',5,[.267,1.16,0]],['hand.R',6,[.30,.925,0]],
 ['upperArm.L',2,[-.205,1.425,0]],['forearm.L',8,[-.267,1.16,0]],['hand.L',9,[-.30,.925,0]],
 ['thigh.R',0,[.095,.91,0]],['shin.R',11,[.095,.505,0]],['foot.R',12,[.095,.085,0]],
 ['thigh.L',0,[-.095,.91,0]],['shin.L',14,[-.095,.505,0]],['foot.L',15,[-.095,.085,0]],
];
export const joint=Object.fromEntries(bones.map((b,i)=>[b[0],i]));
export const clips={idle:{duration:2.4,stride:0},run:{duration:1,stride:2.4},sprint:{duration:1,stride:3.2},turnLeft:{duration:1,stride:0},turnRight:{duration:1,stride:0}};
const qx=a=>[Math.sin(a/2),0,0,Math.cos(a/2)];
const qz=a=>[0,0,-Math.sin(a/2),Math.cos(a/2)]; // X-reflected authoring -> glTF
export function pose(name,phase){
 const rotation=bones.map(()=>[0,0,0,1]),translation=bones.map((b)=>{const parent=b[1]<0?[0,0,0]:bones[b[1]][2];return [-b[2][0]+parent[0],b[2][1]-parent[1],b[2][2]-parent[2]];});
 const tau=Math.PI*2;
 if(name==='idle'){
   rotation[1]=qx(.012*Math.sin(phase*tau));rotation[2]=qx(-.009*Math.sin(phase*tau));
   rotation[5]=qz(.035);rotation[8]=qz(-.035);rotation[6]=qx(-.07);rotation[9]=qx(-.07);
 }else if(name.startsWith('turn')){
   const sign=name==='turnLeft'?1:-1,pulse=.85+.15*Math.cos(phase*tau);
   rotation[1]=qz(sign*.10*pulse);rotation[2]=qz(sign*.09*pulse);rotation[4]=qz(-sign*.06*pulse);
   rotation[5]=qz(sign*.13*pulse);rotation[8]=qz(sign*.13*pulse);
 }else{
   const sprint=name==='sprint',stance=sprint?.26:.33,stride=clips[name].stride;
   const hipY=(sprint?.77:.78)+.012*Math.cos(phase*tau*2);
   translation[0][1]=hipY;rotation[1]=qx(sprint?.16:.07);rotation[2]=qx(sprint?.10:.04);
   for(let side=0;side<2;side++){
     const p=(phase+side*.5)%1,u=(p-stance)/(1-stance),half=stride*stance/2;
     const z=p<stance?half-stride*p:-half+stride*stance*(u*u*(3-2*u));
     const y=.085+(p<stance?0:(sprint?.32:.22)*Math.sin(Math.PI*u));
     const dy=y-hipY,dz=z,len=Math.min(.8249,Math.hypot(dy,dz)),l1=.405,l2=.42;
     const a=Math.atan2(dz,-dy)+Math.acos(Math.max(-1,Math.min(1,(l1*l1+len*len-l2*l2)/(2*l1*len))));
     const kneeY=hipY-l1*Math.cos(a),kneeZ=l1*Math.sin(a),b=Math.atan2(z-kneeZ,kneeY-y);
     const thigh=side?11:14,arm=side?5:8;
     rotation[thigh]=qx(-a);rotation[thigh+1]=qx(a-b);rotation[thigh+2]=qx(b);
     rotation[arm]=qx((sprint?.85:.62)*Math.cos(p*tau));rotation[arm+1]=qx(-(sprint?1.5:1.2));
   }
   rotation[4]=qx(-.06); // eyes toward route
 }
 return {rotation,translation};
}
