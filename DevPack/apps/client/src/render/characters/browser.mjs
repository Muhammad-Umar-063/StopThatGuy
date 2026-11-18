// Actual dev and production rendering; invoke through batch3/run-browser.sh.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {dirname,resolve,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'node:http';
import {build,preview,createServer} from 'vite';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../../../..'),dev=process.argv.includes('--dev'),RESULTS=resolve(ROOT,'test-results/characters',dev?'dev':'built');
const URL='http://127.0.0.1:5215/src/render/characters/preview.html',report={ok:false,renderMode:'Controlled real WebGL frames for stable software-renderer capture; no FPS benchmark',startedAt:new Date().toISOString(),source:JSON.parse(readFileSync(resolve(ROOT,'assets-source/characters/export-report.json'),'utf8')),runtimeHashes:Object.fromEntries(['character.ts','animation.ts','contactShadow.ts','preview.ts','browser.mjs','vite.config.mjs'].map(n=>[n,createHash('sha256').update(readFileSync(resolve(HERE,n))).digest('hex')])),mode:dev?'dev':'built',url:URL,browser:null,renderer:null,views:[],steps:[],errors:[]};mkdirSync(RESULTS,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),until=async(label,fn,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){const v=await fn();if(v)return v;await sleep(100);}throw new Error(`Timed out: ${label}`);};
let server,browser,profile,ws,send,expectedFailure=false;
const save=()=>writeFileSync(resolve(RESULTS,'browser.json'),JSON.stringify(report,null,2)+'\n');save();
async function stop(){ws?.close();if(browser?.pid&&browser.exitCode===null&&browser.signalCode===null){const done=new Promise(r=>browser.once('exit',r));browser.kill('SIGTERM');await Promise.race([done,sleep(2000)]);if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL');}server?.httpServer?.closeAllConnections();if(server?.close)await Promise.race([server.close(),sleep(3000)]);else if(server?.httpServer)await new Promise(r=>server.httpServer.close(r));if(profile)rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{report.failure=`Interrupted by ${signal}`;save();void stop().finally(()=>process.exit(signal==='SIGTERM'?143:130));});
const timeout=setTimeout(()=>{console.error('Character browser gate exceeded 300 seconds');void stop().finally(()=>process.exit(1));},300000);
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
 const snap=()=>evaluate('window.__characters.snapshot()');
 const ready=()=>until('characters ready',async()=>{const s=await evaluate('window.__characters?.snapshot()');if(s?.state==='failed')throw new Error(s.failure);return s?.state==='ready';},60000);
 const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(RESULTS,`${name}.png`),Buffer.from(r.data,'base64'));save();};
 const key=async(code,key)=>{const vk=code==='Space'?32:code==='ArrowDown'?40:key.toUpperCase().charCodeAt(0);await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});};
 await send('Runtime.enable');await send('Page.enable');await send('Log.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:URL});await ready();await evaluate('window.__characters.pause(true);window.__characters.manualFrames()');
 for(const quality of ['low','medium'])for(const view of [0,1,2]){
  await evaluate(`window.__characters.setQuality('${quality}');window.__characters.setView(${view});window.__characters.setMotion('idle',0);window.__characters.advance(2);`);
  await evaluate('window.__characters.renderFrames(3)');
  const s=await snap();report.renderer=s.renderer;assert.equal(s.characters.length,2);assert.equal(s.worldVersion,'first-street-1');assert.ok(s.drawCalls>0&&s.drawCalls<140);assert.equal(s.characters[0].lod,quality==='low'?1:0);for(const c of s.characters){assert.equal(c.skeletons,1);assert.equal(c.joints,17);assert.equal(c.imageTextures,0);assert.equal(c.materials,2);assert.ok(c.vertexAndIndexBytes>0);assert.ok(c.feet.every(f=>Math.abs(f[1]-(c.position[1]+.085))<.035),'grounded resting ankles on grade');}
  report.views.push(s);await shot(`${quality}-${['chase','front','hill'][view]}`);console.log(`PASS ${quality} view ${view}: ${s.drawCalls} draws; characters ${s.characters.map(c=>c.triangles).join('+')} triangles`);
 }
 await evaluate("window.__characters.setQuality('low');window.__characters.setView(3)");
 await evaluate('window.__characters.renderFrames(3)');
 const far=await snap();assert.ok(far.characters.every(c=>c.lod===2));report.views.push(far);await shot('low-far-lod');
 for(const quality of ['low','medium']){
 await evaluate(`window.__characters.setQuality('${quality}');window.__characters.setView(0)`);
 for(const [name,speed,turn] of [['run',4.8,0],['sprint',7,0],['run',.4,0],['run',3.2,-1],['run',3.2,1],['idle',0,0]]){
  await evaluate(`window.__characters.setMotion('${name}',${speed},${turn});window.__characters.advance(.05)`);await evaluate('window.__characters.renderFrames(1)');const transition=(await snap()).characters.map(c=>({weights:c.weights,turn:c.turn}));await evaluate('window.__characters.advance(1.15);window.__characters.renderFrames(2)');const s=await snap();assert.ok(s.characters.every(c=>c.weights.every(Number.isFinite)));if(speed===.4)assert.ok(s.characters[0].weights[0]>.45&&s.characters[0].weights[0]<.55);if(speed===0)assert.ok(s.characters[0].weights[0]>.99);
  assert.ok(s.characters.every(c=>c.lod===(quality==='low'?1:0)));if(turn!==0)assert.ok(s.characters.every(c=>c.turn*turn>.99),'settled turn follows presentation direction');
  report.steps.push({name:`${quality}/${name}/${speed}/turn${turn}`,transition,characters:s.characters});await shot(`${quality==='low'?'low-':''}motion-${name}-${speed}-${turn}`);
 }
 }
 // Measure world-space stance displacement while the actual rendered character travels.
 await evaluate("window.__characters.setView(0);window.__characters.setMotion('run',4.8,0);window.__characters.advance(1)");
 const stance=await evaluate(`(()=>{const a=window.__characters,errors=[],heights=[];let last=null;for(let i=0;i<120;i++){a.advance(1/240);const c=a.snapshot().characters[0],p=c.feet[0];if(c.phase>.03&&c.phase<.29&&last&&c.phase>last.phase){errors.push(Math.abs(p[2]-last.z));heights.push(p[1]);}last={z:p[2],phase:c.phase};}return {samples:errors.length,maxWorldSlipPerFrame:Math.max(...errors),heightRange:Math.max(...heights)-Math.min(...heights)};})()`);
 assert.ok(stance.samples>12);assert.ok(stance.maxWorldSlipPerFrame<.001);assert.ok(stance.heightRange<.003);report.steps.push({name:'Actual world-space planted stance',...stance});
 await key('KeyL','l');assert.equal((await snap()).quality,'low');await key('Digit3','3');assert.equal((await snap()).mode,'sprint');await key('ArrowDown','ArrowDown');assert.ok((await snap()).speed<7);await key('KeyC','c');assert.equal((await snap()).view,1);report.steps.push('Keyboard-only motion, quality, viewpoint and reduced-speed controls');
 await evaluate("document.querySelector('#idle').focus()");await key('Space',' ');assert.equal((await snap()).mode,'idle','focused native button accepts Space');report.steps.push('Native focused buttons remain keyboard accessible');
 const before=await snap();
 for(let i=0;i<3;i++){await evaluate('window.__characters.reload()');await ready();await evaluate('window.__characters.renderFrames(2)');await sleep(50);const after=await snap();assert.deepEqual(after.resources,before.resources,'repeat load resource plateau');}
 await evaluate('window.__characters.unload()');await sleep(50);const empty=await snap();assert.deepEqual(empty.resources,empty.baseResources,'all character resources and subscriptions released');report.steps.push({name:'Three reloads and full character disposal',loaded:before.resources,unloaded:empty.resources});
 const cancelled=await evaluate('window.__characters.cancellation()');assert.equal(cancelled.code,'cancelled');await sleep(50);assert.deepEqual((await snap()).resources,empty.resources);report.steps.push({name:'In-flight cancellation',code:cancelled.code});
 expectedFailure=true;await evaluate("window.__characters.reload('/deliberately-missing/')");assert.equal((await snap()).state,'failed');assert.match((await snap()).failure,/Could not load visual asset/);await shot('load-failure');await sleep(50);assert.deepEqual((await snap()).resources,empty.resources);expectedFailure=false;
 await evaluate('window.__characters.reload()');await ready();await evaluate('window.__characters.renderFrames(2)');report.steps.push('Failed load is visible, cleans up and can be retried');
 await evaluate('window.__characters.shutdown()');const final=await snap();for(const k of ['meshes','materials','textures','skeletons','animationGroups','transformNodes'])assert.equal(final.resources[k],0);assert.deepEqual(report.errors,[]);report.ok=true;console.log(`PASS characters ${report.mode}: ${report.views.length} views, ${report.steps.length} motion/input/lifecycle checks, clean console`);
}catch(e){report.failure=e instanceof Error?e.message:String(e);console.error(report.failure);process.exitCode=1;if(send)try{const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(RESULTS,'failure.png'),Buffer.from(r.data,'base64'));}catch{}}
finally{clearTimeout(timeout);report.finishedAt=new Date().toISOString();save();await stop();process.exit(process.exitCode??0);}
