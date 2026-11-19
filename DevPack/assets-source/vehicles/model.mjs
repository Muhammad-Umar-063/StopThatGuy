import {geometry,tube,ellipsoid,body,torus,offset,finish} from './geometry.mjs';
import {definitions} from './definition.mjs';
const C={rubber:[.035,.043,.047],metal:[.46,.52,.52],dark:[.10,.14,.15],cream:[.85,.79,.62],teal:[.035,.32,.32],coral:[.65,.19,.12],gold:[.88,.53,.13],leather:[.22,.12,.065],light:[1,.92,.67],red:[.58,.035,.025]};
export function model(type,lod){
 const d=definitions[type],n=(type==='lift'?[18,12,8]:[28,16,10])[lod],s=(type==='lift'?[8,6,4]:[10,7,5])[lod],b=(type==='lift'?[20,12,8]:[24,16,12])[lod],parts=[];
 const part=(name,parent,origin,fn)=>{const g=geometry();fn(g);parts.push({name,parent,geometry:finish(offset(g,origin))});};
 const pipe=(g,a,z,r,c=C.metal)=>tube(g,a,z,r,c,s);
 const shell=(g,c,rows,color)=>body(g,c,rows,color,b);
 const oval=(g,c,r,color)=>ellipsoid(g,c,r,color,n,(type==='lift'?[6,4,3]:[8,6,4])[lod]);
 for(const wheel of d.wheels){
  part(wheel.pivot,wheel.pivot,[0,0,0],g=>{
   const radius=wheel.radiusM,width=type==='bicycle'?.027:type==='scooter'?.065:.083,minor=type==='bicycle'?.025:.055;
   torus(g,[0,0,0],radius-minor,minor,width,C.rubber,n,[8,6,5][lod]);
   torus(g,[0,0,0],radius-minor*2,.012,width*.75,C.metal,n,8);
   pipe(g,[-width,0,0],[width,0,0],type==='bicycle'?.045:.105,C.metal);
   const spokes=type==='bicycle'?[16,10,6][lod]:[8,6,4][lod];
   for(let i=0;i<spokes;i++){const a=i/spokes*Math.PI*2;pipe(g,[0,0,0],[0,Math.cos(a)*(radius-minor*2),Math.sin(a)*(radius-minor*2)],type==='bicycle'?.004:.018,type==='bicycle'?C.metal:C.cream);}
  });
 }
 if(type==='bicycle'){
  part('frame',null,[0,0,0],g=>{
   const pedal=[0,.31,-.1],seat=[0,.79,-.19],head=[0,.77,.42],rear=[0,.32,-.54];
   for(const [a,z] of [[pedal,seat],[seat,head],[head,pedal],[seat,rear],[pedal,rear]])pipe(g,a,z,.021,C.teal);
   for(const x of [-.045,.045]){pipe(g,[x,.32,-.54],[x,.77,-.19],.011,C.teal);pipe(g,[x,.32,-.54],[x,.31,-.1],.011,C.teal);}
   pipe(g,[0,.77,-.19],[0,.87,-.19],.014,C.metal);
   shell(g,[0,.85,-.19],[[0,.11,.15],[.01,.14,.18],[.045,.135,.17],[.055,.09,.14],[.056,0,0]],C.leather);
   // Rear carrier, brakes, chain guard and shallow fenders.
   for(const x of [-.10,.10]){pipe(g,[x,.67,-.76],[x,.67,-.36],.009);pipe(g,[x,.67,-.7],[x*.5,.32,-.54],.008);}
   for(const z of [-.74,-.63,-.52,-.41])pipe(g,[-.1,.67,z],[.1,.67,z],.007);
   pipe(g,[.055,.31,-.54],[.055,.31,-.10],.018,C.dark);
   for(const z of [-.54])for(let i=0;i<8;i++){const a=.15+i/8*(Math.PI-.3),a2=.15+(i+1)/8*(Math.PI-.3);pipe(g,[0,.32+.342*Math.sin(a),z+.342*Math.cos(a)],[0,.32+.342*Math.sin(a2),z+.342*Math.cos(a2)],.015,C.cream);}
   oval(g,[0,.66,-.78],[.035,.02,.018],C.red);
  });
  part('steering','pivot.steering',d.pivots['pivot.steering'].position,g=>{
   for(const x of [-.045,.045])pipe(g,[x,.32,.54],[x,.78,.42],.014,C.teal);
   pipe(g,[0,.70,.44],[0,1.03,.39],.017,C.metal);
   for(const sign of [-1,1]){pipe(g,[0,1.03,.39],[sign*.18,1.07,.35],.014);pipe(g,[sign*.18,1.07,.35],[sign*.30,1.07,.35],.023,C.dark);pipe(g,[sign*.24,1.045,.37],[sign*.31,1.035,.38],.006,C.metal);}
   oval(g,[0,.91,.46],[.042,.042,.035],C.light);
   for(let i=0;i<8;i++){const a=.15+i/8*(Math.PI-.3),a2=.15+(i+1)/8*(Math.PI-.3);pipe(g,[0,.32+.342*Math.sin(a),.54+.342*Math.cos(a)],[0,.32+.342*Math.sin(a2),.54+.342*Math.cos(a2)],.015,C.cream);}
  });
  part('crank','pivot.crank',d.pivots['pivot.crank'].position,g=>{
   pipe(g,[-.07,.31,-.1],[.07,.31,-.1],.024,C.metal);
   for(const sign of [-1,1]){pipe(g,[sign*.075,.31,-.1],[sign*.075,.31,-.1-sign*.15],.012);pipe(g,[sign*.075,.31,-.1-sign*.15],[sign*.17,.31,-.1-sign*.15],.025,C.dark);}
  });
 }else if(type==='scooter'){
  part('body',null,[0,0,0],g=>{
   shell(g,[0,0,-.40],[[.24,0,0],[.29,.23,.36],[.40,.26,.38],[.54,.23,.34],[.65,.16,.27],[.69,0,0]],C.coral);
   shell(g,[0,0,.12],[[.19,0,0],[.21,.25,.37],[.25,.25,.37],[.27,0,0]],C.dark);
   // A curved leg shield, with a narrower neck and contrasting inner inset.
   shell(g,[0,0,.46],[[.26,0,0],[.28,.24,.035],[.40,.25,.045,.04],[.56,.25,.05,.05],[.82,.20,.045,.02],[.94,.10,.035,-.02],[.96,0,0,-.02]],C.cream);
   shell(g,[0,0,-.23],[[.66,0,0],[.68,.185,.35],[.72,.20,.35],[.75,.18,.31],[.76,0,0]],C.leather);
   pipe(g,[-.18,.66,-.56],[-.18,.76,-.63],.013);pipe(g,[.18,.66,-.56],[.18,.76,-.63],.013);pipe(g,[-.18,.76,-.63],[.18,.76,-.63],.013);
   oval(g,[0,.49,-.77],[.10,.04,.018],C.red);
   for(const x of [-.235,.235]){pipe(g,[x,.30,-.55],[x,.30,-.20],.025,C.metal);oval(g,[x,.44,-.40],[.018,.075,.16],C.cream);}
  });
  part('steering','pivot.steering',d.pivots['pivot.steering'].position,g=>{
   for(const x of [-.075,.075])pipe(g,[x,.23,.74],[x,.68,.61],.022,C.metal);
   oval(g,[0,.47,.74],[.095,.035,.24],C.coral);
   pipe(g,[0,.55,.64],[0,1.02,.44],.025,C.dark);
   oval(g,[0,1.04,.47],[.17,.065,.085],C.coral);
   oval(g,[0,1.04,.54],[.07,.055,.018],C.light);
   for(const sign of [-1,1]){
    pipe(g,[0,1.05,.44],[sign*.32,1.05,.44],.018);pipe(g,[sign*.23,1.05,.44],[sign*.33,1.05,.44],.028,C.dark);
    pipe(g,[sign*.21,1.07,.44],[sign*.29,1.23,.49],.007);oval(g,[sign*.29,1.25,.49],[.055,.035,.014],C.metal);
   }
  });
 }else{
  part('coachwork',null,[0,0,0],g=>{
   shell(g,[0,0,0],[[.18,0,0],[.20,.66,1.52],[.29,.70,1.55],[.37,.69,1.52],[.39,0,0]],C.teal);
   shell(g,[0,0,1.35],[[.36,0,0],[.40,.66,.21],[.65,.66,.20],[.83,.59,.17],[.89,.52,.13],[.90,0,0]],C.gold);
   // Open cab and rear passenger canopy; no opaque glazing hides the fit fixture.
   shell(g,[0,1.88,0],[[0,0,0],[.01,.72,1.47],[.055,.74,1.48],[.095,.70,1.44],[.10,0,0]],C.cream);
   for(const x of [-.65,.65])for(const z of [-1.30,1.20])pipe(g,[x,.34,z],[x,1.91,z*.94],.025,C.teal);
   for(const x of [-.67,.67]){pipe(g,[x,.73,-1.40],[x,.73,-.25],.022,C.metal);pipe(g,[x,.30,-.25],[x,.73,-.25],.022,C.metal);}
   for(const x of [-.65,.65])for(const z of [-.99,.99])oval(g,[x,.55,z],[.12,.06,.35],C.teal);
   // One driver seat and exactly two passenger pads. Cushions/backrests are rounded.
   for(const [x,y,z] of [[0,.76,.60],[-.36,.69,-.82],[.36,.69,-.82]]){
    pipe(g,[x,.3,z],[x,y-.1,z],.035,C.dark);
    shell(g,[x,y-.09,z],[[0,0,0],[.015,.245,.22],[.075,.25,.22],[.09,.22,.19],[.091,0,0]],C.leather);
    shell(g,[x,y,z-.22],[[0,0,0],[.02,.24,.055],[.28,.22,.055],[.33,.17,.04],[.34,0,0]],C.leather);
   }
   // Passenger hand rails and entry tread.
   for(const x of [-.61,-.11,.11,.61])pipe(g,[x,.91,-.46],[x,1.04,-.46],.018,C.metal);
   for(const x of [-.36,.36])pipe(g,[x-.25,1.04,-.46],[x+.25,1.04,-.46],.018,C.metal);
   for(const x of [-.70,.70])shell(g,[x,.22,-.50],[[0,0,0],[.01,.12,.35],[.04,.12,.35],[.05,0,0]],C.dark);
   pipe(g,[0,.55,1.10],[0,1.08,1.06],.025,C.dark);
   pipe(g,[-.23,1.08,1.06],[.23,1.08,1.06],.025,C.dark);
   for(const x of [-.45,.45]){oval(g,[x,.63,1.53],[.105,.07,.024],C.light);oval(g,[x,.47,-1.55],[.07,.04,.018],C.red);}
   pipe(g,[-.65,.34,1.57],[.65,.34,1.57],.035,C.metal);pipe(g,[-.65,.34,-1.57],[.65,.34,-1.57],.035,C.metal);
   // Original passenger pictogram: two heads above a shared seat, readable beyond paint color.
   for(const x of [-.1,.1])oval(g,[x,.74,1.554],[.045,.045,.014],C.teal);
   pipe(g,[-.16,.62,1.565],[.16,.62,1.565],.018,C.teal);
  });
 }
 return parts;
}
