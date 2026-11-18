import { geometry,loft,ellipsoid,finish,clamp } from './mesh.mjs';
import {joint as J} from './rig.mjs';
const rgb=h=>h.match(/../g).map(x=>((v)=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4)(parseInt(x,16)/255));
export function model(identity,lod){
 const g=geometry(),n=[20,8,6][lod],sub=[2,1,1][lod],detail=lod<2;
 const palette=identity==='player'?{top:'197d80',panel:'225662',skin:'bd805c',hair:'302720',pants:'243342',shoe:'e8e3cf',accent:'e8b64b'}:{top:'873d4c',panel:'542c3d',skin:'b88a69',hair:'292d37',pants:'252936',shoe:'343b49',accent:'c1a57a'};
 const col=k=>rgb(palette[k]??k),fixed=id=>()=>[typeof id==='string'?J[id]:id];
 const weight=(a,b,y0,y1)=>(p)=>[J[a],J[b],clamp((p[1]-y0)/(y1-y0))];
 const torso=p=>p[1]<1.2?weight('hips','spine',.98,1.15)(p):weight('spine','chest',1.18,1.34)(p);
 const L=(rows,c,w=torso,s=n)=>loft(g,rows,s,sub,col(c),w);
 const E=(c,r,color,w=fixed('head'),s=n,steps=Math.max(6,Math.round(n*.65)))=>ellipsoid(g,c,r,s,steps,col(color),w);
 // Tailored torso with shoulder roll, chest volume, waist and a shaped hem.
 L([[0,.89,0,.04,.05],[0,.92,0,.143,.095],[0,1.00,0,.155,.098],[0,1.14,0,.15,.094],[0,1.30,.007,.195,.112],[0,1.39,0,.221,.105],[0,1.445,-.005,.185,.09],[0,1.48,0,.075,.055],[0,1.49,0,.063,.049]],'top');
 L([[0,.895,0,.13,.09],[0,.905,0,.148,.096],[0,.94,0,.154,.099]],'panel');
 // Neck, collar and anatomical face: jaw, cheek, temple, brow and rounded crown.
 L([[0,1.455,0,.061,.048],[0,1.51,0,.062,.053],[0,1.565,.006,.058,.052]],'skin',fixed('neck'));
 L([[0,1.475,0,.067,.056],[0,1.515,0,.07,.059],[0,1.525,0,.065,.054]],'panel',fixed('neck'));
 L([[0,1.54,.025,.035,.039],[0,1.56,.014,.057,.061],[0,1.60,.009,.077,.077],[0,1.65,0,.087,.082],[0,1.70,-.004,.085,.078],[0,1.75,-.012,.077,.071],[0,1.79,-.014,.052,.05],[0,1.805,-.014,.002,.002]],'skin',fixed('head'));
 // Hair/beanie silhouette with a lower band; player has asymmetrical swept fringe.
 L([[0,1.695,-.017,.085,.075],[0,1.735,-.018,.088,.077],[0,1.78,-.019,.071,.064],[0,1.815,-.016,.025,.026],[0,1.82,-.014,.001,.001]],'hair',fixed('head'));
 if(identity==='player')E([-.026,1.75,.055],[.053,.026,.022],'hair');
 else L([[0,1.693,0,.091,.088],[0,1.711,0,.093,.088],[0,1.718,-.003,.091,.086]],'panel',fixed('head'));
 // Nose bridge/tip, lips, ears, eyes and brows retain shape in the close LOD.
 E([0,1.643,.079],[.018,.033,.024],'skin');E([0,1.624,.094],[.022,.012,.018],'skin');
 if(detail){E([0,1.593,.082],[.024,.004,.005],'834c43',fixed('head'),12,6);E([0,1.599,.082],[.023,.003,.005],'a35e51',fixed('head'),12,6);}
 for(const s of [-1,1]){
   E([s*.086,1.642,-.008],[.017,.032,.020],'skin');
   E([s*.034,1.663,.075],[.022,.009,.007],'f2e7d5');E([s*.034,1.663,.082],[.007,.007,.003],'3c3931',fixed('head'),detail?12:8,6);
   if(detail){E([s*.034,1.682,.072],[.025,.005,.007],'hair',fixed('head'),12,6);E([s*.088,1.641,.004],[.008,.019,.006],'9c654e',fixed('head'),12,6);}
   const side=s===1?'R':'L',upper=J[`upperArm.${side}`],fore=upper+1,hand=upper+2;
   const armWeight=p=>p[1]>1.19?[upper]:p[1]<.98?[fore,hand,clamp((.99-p[1])/.08)]:[upper,fore,clamp((1.23-p[1])/.14)];
   // Bent-taper sleeve profiles: natural elbow, broad upper arm, narrow wrist.
   L([[s*.306,.935,0,.036,.038],[s*.30,.97,0,.042,.043],[s*.283,1.07,0,.053,.053],[s*.268,1.16,0,.058,.057],[s*.249,1.27,0,.066,.066],[s*.217,1.39,0,.077,.077],[s*.198,1.45,0,.047,.051]],'top',armWeight);
   L([[s*.306,.934,0,.038,.04],[s*.301,.975,0,.043,.044]],'panel',fixed(fore));
   E([s*.312,.889,.009],[.038,.067,.026],'skin',fixed(hand));E([s*.282,.907,.027],[.017,.033,.018],'skin',fixed(hand),detail?12:8,8);
   const legWeight=p=>p[1]>.82?weight(`thigh.${side}`,'hips',.82,.96)(p):p[1]<.23?weight(`foot.${side}`,`shin.${side}`,.11,.23)(p):weight(`shin.${side}`,`thigh.${side}`,.45,.56)(p);
   L([[s*.095,.11,0,.039,.046],[s*.095,.16,0,.043,.050],[s*.095,.30,-.012,.056,.064],[s*.095,.47,0,.061,.062],[s*.095,.56,0,.065,.066],[s*.095,.73,-.008,.076,.083],[s*.095,.88,0,.085,.091],[s*.086,.96,0,.080,.076]],'pants',legWeight);
   // Shaped footwear with flattened sole, toe box, heel and ankle opening.
   const f=fixed(`foot.${side}`);
   L([[s*.095,.006,.065,.041,.133],[s*.095,.022,.065,.047,.14],[s*.095,.05,.065,.049,.142],[s*.095,.083,.061,.047,.13],[s*.095,.112,.026,.044,.085],[s*.095,.133,0,.037,.043]],'shoe',f);
   L([[s*.095,.003,.065,.040,.131],[s*.095,.018,.065,.048,.141],[s*.095,.028,.065,.048,.141]],identity==='player'?'bdb8a6':'171d29',f);
   if(detail)for(let k=0;k<3;k++)E([s*.095,.105-k*.009,.065+k*.025],[.031,.004,.004],identity==='player'?'f8f2e4':'73818c',f,12,6);
 }
 // Distinct chest insignia and continuous zip/piping are shaped geometry, no texture dependency.
 if(detail){
   L([[0,.95,.100,.002,.003],[0,1.14,.097,.002,.003],[0,1.30,.121,.002,.003],[0,1.41,.105,.002,.003]],'accent');
   E([.10,1.34,.106],[.029,.016,.006],'accent',fixed('chest'),12,6);
 }
 if(identity==='robber'){
   // Rounded canvas satchel behind right hip: visible in silhouette at every LOD.
   E([-.24,1.025,-.115],[.145,.20,.10],'accent',fixed('hips'));
   L([[-.24,1.15,-.11,.10,.081],[-.24,1.21,-.11,.07,.058],[-.24,1.24,-.11,.04,.035]],'panel',fixed('hips'));
   // Cross-body strap over the chest, continued around the back.
   for(const zSign of [-1,1])L([[-.22,1.00,zSign*.105,.018,.009],[-.13,1.16,zSign*.109,.018,.009],[.02,1.32,zSign*.12,.018,.009],[.16,1.44,zSign*.095,.018,.009]],'accent');
   if(detail)L([[-.24,.96,-.205,.03,.009],[-.24,.974,-.210,.065,.010],[-.24,1.065,-.214,.065,.010],[-.24,1.074,-.214,.052,.010]],'panel',fixed('hips'),12);
 }
 return finish(g);
}
