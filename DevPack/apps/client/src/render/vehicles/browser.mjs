// Actual dev and production rendering; invoke through batch4/run-browser.sh.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,resolve,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'node:http';
import {build,preview,createServer} from 'vite';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../../../..'),dev=process.argv.includes('--dev'),RESULTS=resolve(ROOT,'test-results/vehicles',dev?'dev':'built');
const URL='http://127.0.0.1:5219/src/render/vehicles/preview.html',report={ok:false,renderMode:'Controlled real WebGL frames for stable software-renderer capture; no FPS benchmark',startedAt:new Date().toISOString(),source:JSON.parse(readFileSync(resolve(ROOT,'assets-source/vehicles/export-report.json'),'utf8')),runtimeHashes:Object.fromEntries(['vehicle.ts','definitions.ts','definitions.generated.json','staticFit.ts','preview.ts','browser.mjs','vite.config.mjs'].map(n=>[n,createHash('sha256').update(readFileSync(resolve(HERE,n))).digest('hex')])),mode:dev?'dev':'built',url:URL,browser:null,renderer:null,views:[],steps:[],errors:[]};mkdirSync(RESULTS,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),until=async(label,fn,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){const v=await fn();if(v)return v;await sleep(100);}throw new Error(`Timed out: ${label}`);};
let server,browser,profile,ws,send,expectedFailure=false;
const save=()=>writeFileSync(resolve(RESULTS,'browser.json'),JSON.stringify(report,null,2)+'\n');save();
async function stop(){ws?.close();if(browser?.pid&&browser.exitCode===null&&browser.signalCode===null){const done=new Promise(r=>browser.once('exit',r));browser.kill('SIGTERM');await Promise.race([done,sleep(2000)]);if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL');}server?.httpServer?.closeAllConnections();if(server?.close)await Promise.race([server.close(),sleep(3000)]);else if(server?.httpServer)await new Promise(r=>server.httpServer.close(r));if(profile)rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{report.failure=`Interrupted by ${signal}`;save();void stop().finally(()=>process.exit(signal==='SIGTERM'?143:130));});
const timeout=setTimeout(()=>{console.error('Vehicle browser gate exceeded 420 seconds');void stop().finally(()=>process.exit(1));},420000);
try{
 const config={configFile:resolve(HERE,'vite.config.mjs')};
 if(dev){server=await createServer(config);await server.listen();}else{await build(config);server=await preview(config);}
 const exe=process.env.CHROME_PATH??(process.env.PATH??'').split(delimiter).flatMap(d=>['google-chrome','chromium','chromium-browser'].map(n=>resolve(d,n))).find(existsSync);assert.ok(exe,'Chrome is required');
 profile=mkdtempSync(resolve(RESULTS,'profile-'));browser=spawn(exe,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CI?['--no-sandbox']:[]),'about:blank'],{stdio:'ignore'});
 const port=await until('Chrome',()=>{if(browser.exitCode!==null)throw new Error(`Chrome exited ${browser.exitCode}`);const p=resolve(profile,'DevToolsActivePort');return existsSync(p)?readFileSync(p,'utf8').split('\n')[0]:null;});
 report.browser=(await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
 const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 const pending=new Map();let seq=0;send=(method,params={})=>new Promise((res,rej)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);rej(new Error(`CDP timeout ${method}`));},method==='Page.captureScreenshot'?60000:30000);pending.set(id,m=>{clearTimeout(t);m.error?rej(new Error(m.error.message)):res(m.result);});ws.send(JSON.stringify({id,method,params}));});
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);return;}const p=m.params??{};if(m.method==='Runtime.exceptionThrown')report.errors.push(p.exceptionDetails?.exception?.description??p.exceptionDetails?.text);if(m.method==='Runtime.consoleAPICalled'&&p.type==='error')report.errors.push(p.args.map(a=>a.value??a.description).join(' '));if(m.method==='Log.entryAdded'&&p.entry?.level==='error'&&!expectedFailure)report.errors.push(`${p.entry.text} (${p.entry.url??'no URL'})`);});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;};
 const snap=()=>evaluate('window.__vehicles.snapshot()');
 const ready=()=>until('vehicles ready',async()=>{const s=await evaluate('window.__vehicles?.snapshot()');if(s?.state==='failed')throw new Error(s.failure);return s?.state==='ready';},60000);
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(RESULTS,`${name}.png`),Buffer.from(r.data,'base64'));save();};
 const key=async(code,key)=>{const vk=code==='Space'?32:code==='ArrowDown'?40:key.toUpperCase().charCodeAt(0);await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});};
 await send('Runtime.enable');await send('Page.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:URL});await ready();await evaluate('window.__vehicles.manualFrames()');
 for(const type of ['bicycle','scooter','lift']){
  await evaluate(`window.__vehicles.select('${type}')`);await ready();
  for(const quality of ['low','medium']){
   await evaluate(`window.__vehicles.setQuality('${quality}')`);
   for(const view of [0,1,2]){
    await evaluate(`window.__vehicles.setView(${view});window.__vehicles.renderFrames(3)`);
    const s=await snap();report.renderer=s.renderer;assert.equal(s.worldVersion,'first-street-1');assert.equal(s.vehicle.type,type);assert.equal(s.vehicle.lod,quality==='low'?1:0);assert.equal(s.vehicle.imageTextures,0);assert.equal(s.vehicle.materials,2);assert.ok(s.vehicle.bufferBytes>0);assert.ok(s.drawCalls>0&&s.drawCalls<120);assert.ok(s.submittedTriangles>0);if(quality==='low')assert.ok(s.submittedTriangles<250000);report.views.push(s);await shot(`${type}-${quality}-${['chase','front','side'][view]}`);
   }
   await evaluate('window.__vehicles.setFit(true)');await ready();await evaluate('window.__vehicles.setView(2);window.__vehicles.renderFrames(3)');const fit=await snap();assert.equal(fit.fits.length,type==='lift'?3:1);assert.equal(fit.characters.length,fit.fits.length);for(const f of fit.fits){assert.ok(f.seatErrorM<.001);for(const c of [...f.hands,...f.feet])assert.ok(c.errorM<.012,`${type} contact gap ${c.errorM}`);}assert.ok(fit.drawCalls<120);report.views.push(fit);await shot(`${type}-${quality}-static-fit`);
   await evaluate('window.__vehicles.setFit(false)');await ready();
  }
  await evaluate("window.__vehicles.setQuality('medium');window.__vehicles.setView(4);window.__vehicles.renderFrames(2)");const yaw=await snap();assert.ok(yaw.vehicle.bounds.max.every(Number.isFinite));report.steps.push({name:`${type} +90-degree yaw`,vehicle:yaw.vehicle});
  await evaluate('window.__vehicles.setView(0);window.__vehicles.motion(2,.3);window.__vehicles.advance(.1);window.__vehicles.motion(0,.3);window.__vehicles.renderFrames(2)');const moving=await snap();assert.ok(moving.vehicle.wheelAngles.every(a=>a>0));report.steps.push({name:`${type} wheel and steering articulation`,vehicle:moving.vehicle});await shot(`${type}-articulation`);
  await evaluate("window.__vehicles.motion(0,0);window.__vehicles.setQuality('low');window.__vehicles.setView(5);window.__vehicles.renderFrames(2)");const far=await snap();assert.equal(far.vehicle.lod,2);report.views.push(far);await shot(`${type}-low-far`);
  console.log(`PASS ${type}: low/medium art and real character fit, yaw, motion and far LOD`);
 }
 await evaluate('window.__vehicles.setView(3);window.__vehicles.renderFrames(3)');report.views.push(await snap());await shot('lift-hill-street');
 await key('KeyL','l');assert.equal((await snap()).quality,'low');await key('ArrowRight','ArrowRight');assert.ok((await snap()).steer>0);await key('Digit2','2');await ready();assert.equal((await snap()).type,'scooter');await key('KeyC','c');assert.equal((await snap()).view,4);report.steps.push('Keyboard quality, steering, model and camera controls');
 await evaluate("document.querySelector('#bicycle').focus()");await key('Space',' ');await ready();assert.equal((await snap()).type,'bicycle');report.steps.push('Focused native button accepts Space');
 await evaluate('window.__vehicles.setView(0);window.__vehicles.setFit(true)');await ready();await evaluate('window.__vehicles.renderFrames(2)');
 // Hold real HTTP requests while the user changes quality during an awaited load.
 for(const pattern of ['*assets/vehicles/bicycle.glb*','*assets/characters/player.glb*']){
  await evaluate("window.__vehicles.setQuality('medium')");
  const paused=new Promise(resolve=>{const handler=e=>{const event=JSON.parse(String(e.data));if(event.method==='Fetch.requestPaused'){ws.removeEventListener('message',handler);resolve(event.params.requestId);}};ws.addEventListener('message',handler);});
  await send('Fetch.enable',{patterns:[{urlPattern:pattern,requestStage:'Request'}]});
  await evaluate('void window.__vehicles.reload()');const requestId=await Promise.race([paused,sleep(15000).then(()=>{throw new Error('No intercepted model request');})]);
  await evaluate("window.__vehicles.setQuality('low')");await send('Fetch.continueRequest',{requestId});await send('Fetch.disable');await ready();await evaluate('window.__vehicles.renderFrames(2)');const pendingQuality=await snap();assert.equal(pendingQuality.vehicle.lod,1);assert.ok(pendingQuality.characters.every(c=>c.lod===1));
 }
 report.steps.push('Quality changes during delayed vehicle and character HTTP loads use latest setting');
 const before=await snap();
 for(let i=0;i<3;i++){await evaluate('window.__vehicles.reload()');await ready();await evaluate('window.__vehicles.renderFrames(2)');await sleep(50);assert.deepEqual((await snap()).resources,before.resources,'reload resource plateau');}
 await evaluate('window.__vehicles.unload()');await sleep(50);const empty=await snap();assert.deepEqual(empty.resources,empty.baseResources,'all vehicle and fit resources released');report.steps.push({name:'Three reloads and disposal',loaded:before.resources,unloaded:empty.resources});
 const cancelled=await evaluate('window.__vehicles.cancellation()');assert.equal(cancelled,'cancelled');await sleep(50);assert.deepEqual((await snap()).resources,empty.resources);report.steps.push('In-flight cancellation releases resources');
 expectedFailure=true;await evaluate("window.__vehicles.reload('/deliberately-missing/')");assert.equal((await snap()).state,'failed');assert.match((await snap()).failure,/Could not load visual asset/);await shot('load-failure');await sleep(50);assert.deepEqual((await snap()).resources,empty.resources);expectedFailure=false;
 await evaluate('window.__vehicles.reload()');await ready();await evaluate('window.__vehicles.renderFrames(2)');report.steps.push('Visible missing-load failure, cleanup and retry');
 await evaluate('window.__vehicles.shutdown()');const final=await snap();for(const k of ['meshes','materials','textures','skeletons','animationGroups','transformNodes'])assert.equal(final.resources[k],0);assert.deepEqual(report.errors,[]);report.ok=true;console.log(`PASS vehicles ${report.mode}: ${report.views.length} views, ${report.steps.length} articulation/input/lifecycle checks, clean console`);
}catch(e){report.failure=e instanceof Error?e.message:String(e);console.error(report.failure);process.exitCode=1;if(send)try{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(RESULTS,'failure.png'),Buffer.from(r.data,'base64'));}catch{}}
finally{clearTimeout(timeout);report.finishedAt=new Date().toISOString();save();await stop();process.exit(process.exitCode??0);}
