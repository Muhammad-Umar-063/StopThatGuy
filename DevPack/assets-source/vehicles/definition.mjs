// Canonical authored visual dimensions/anchors. Clearance values are references,
// not gameplay colliders; tests compare them to WORLD_LAYOUT_LIMITS.spawnFootprint.
const anchor=(parent,position)=>({parent,position});
const clearance=(radiusM,heightM)=>({source:'WORLD_LAYOUT_LIMITS.spawnFootprint',radiusM,heightM,scope:'unoccupied parked vehicle only; not a moving collider or rider envelope'});
export const definitions={
 bicycle:{id:'vehicle.bicycle',label:'Arco city bicycle',clearance:clearance(.9,1.4),
  pivots:{'pivot.steering':{parent:null,position:[0,.32,.54]},'pivot.wheel.front':{parent:'pivot.steering',position:[0,0,0]},'pivot.wheel.rear':{parent:null,position:[0,.32,-.54]},'pivot.crank':{parent:null,position:[0,.31,-.1]}},
  wheels:[{pivot:'pivot.wheel.front',radiusM:.32},{pivot:'pivot.wheel.rear',radiusM:.32}],steering:['pivot.steering'],crank:'pivot.crank',
  anchors:{'seat.rider':anchor(null,[0,.906,-.19]),'hand.rider.L':anchor('pivot.steering',[-.28,.75,-.19]),'hand.rider.R':anchor('pivot.steering',[.28,.75,-.19]),'foot.rider.L':anchor('pivot.crank',[-.14,.025,.15]),'foot.rider.R':anchor('pivot.crank',[.14,.025,-.15])},
  seats:[{id:'rider',role:'rider',seat:'seat.rider',hands:['hand.rider.L','hand.rider.R'],feet:['foot.rider.L','foot.rider.R'],fitLeanRadians:.7}],
 },
 scooter:{id:'vehicle.scooter',label:'Aurora step-through scooter',clearance:clearance(1,1.4),
  pivots:{'pivot.steering':{parent:null,position:[0,.23,.74]},'pivot.wheel.front':{parent:'pivot.steering',position:[0,0,0]},'pivot.wheel.rear':{parent:null,position:[0,.23,-.61]}},
  wheels:[{pivot:'pivot.wheel.front',radiusM:.23},{pivot:'pivot.wheel.rear',radiusM:.23}],steering:['pivot.steering'],crank:null,
  anchors:{'seat.rider':anchor(null,[0,.76,-.10]),'hand.rider.L':anchor('pivot.steering',[-.30,.82,-.30]),'hand.rider.R':anchor('pivot.steering',[.30,.82,-.30]),'foot.rider.L':anchor(null,[-.17,.26,.18]),'foot.rider.R':anchor(null,[.17,.26,.18])},
  seats:[{id:'rider',role:'rider',seat:'seat.rider',hands:['hand.rider.L','hand.rider.R'],feet:['foot.rider.L','foot.rider.R'],fitLeanRadians:.32}],
 },
 lift:{id:'vehicle.lift',label:'Largo electric delivery lift',clearance:clearance(2.2,2.5),
  pivots:{'pivot.steering.L':{parent:null,position:[-.65,.28,.99]},'pivot.steering.R':{parent:null,position:[.65,.28,.99]},'pivot.wheel.front.L':{parent:'pivot.steering.L',position:[0,0,0]},'pivot.wheel.front.R':{parent:'pivot.steering.R',position:[0,0,0]},'pivot.wheel.rear.L':{parent:null,position:[-.65,.28,-.99]},'pivot.wheel.rear.R':{parent:null,position:[.65,.28,-.99]}},
  wheels:['front.L','front.R','rear.L','rear.R'].map(n=>({pivot:`pivot.wheel.${n}`,radiusM:.28})),steering:['pivot.steering.L','pivot.steering.R'],crank:null,
  anchors:Object.fromEntries([
   ['seat.driver',anchor(null,[0,.76,.60])],['hand.driver.L',anchor(null,[-.20,1.08,1.06])],['hand.driver.R',anchor(null,[.20,1.08,1.06])],['foot.driver.L',anchor(null,[-.16,.40,.93])],['foot.driver.R',anchor(null,[.16,.40,.93])],
   ...[-.36,.36].flatMap((x,i)=>[[`seat.passenger.${i}`,anchor(null,[x,.69,-.82])],[`hand.passenger.${i}.L`,anchor(null,[x-.25,1.04,-.46])],[`hand.passenger.${i}.R`,anchor(null,[x+.25,1.04,-.46])],[`foot.passenger.${i}.L`,anchor(null,[x-.13,.40,-.38])],[`foot.passenger.${i}.R`,anchor(null,[x+.13,.40,-.38])]])]),
  seats:[{id:'driver',role:'driver',seat:'seat.driver',hands:['hand.driver.L','hand.driver.R'],feet:['foot.driver.L','foot.driver.R'],fitLeanRadians:.15},...[0,1].map(i=>({id:`passenger.${i}`,role:'passenger',seat:`seat.passenger.${i}`,hands:[`hand.passenger.${i}.L`,`hand.passenger.${i}.R`],feet:[`foot.passenger.${i}.L`,`foot.passenger.${i}.R`],fitLeanRadians:0}))],
 }
};
