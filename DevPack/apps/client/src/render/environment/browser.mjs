// Isolated T011 production-preview acceptance. Only starts/stops its own processes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { dirname,resolve,delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'node:http';
import { build,preview } from 'vite';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../../../../..'),RESULTS=resolve(ROOT,process.env.ENVIRONMENT_EVIDENCE_DIR??'test-results/environment');
const URL='http://127.0.0.1:5211/src/render/environment/preview.html';
const report={ok:false,url:URL,browser:null,renderer:null,views:[],errors:[],steps:[]};
mkdirSync(RESULTS,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(label,fn,timeoutMs=30000)=>{const end=Date.now()+timeoutMs;while(Date.now()<end){const r=await fn();if(r)return r;await sleep(150);}throw new Error(`Timed out: ${label}`);};
let server,browser,profile,ws,send;
async function stop(){ws?.close();if(browser?.pid&&browser.exitCode===null&&browser.signalCode===null){const exited=new Promise(r=>browser.once('exit',r));browser.kill('SIGTERM');await Promise.race([exited,sleep(2000)]);if(browser.exitCode===null&&browser.signalCode===null)browser.kill('SIGKILL');}if(server?.httpServer)await new Promise(r=>server.httpServer.close(r));if(profile)rmSync(profile,{recursive:true,force:true});}
const total=setTimeout(()=>{console.error('T011 browser gate exceeded 300 seconds');void stop().finally(()=>process.exit(1));},300000);
try{
  const options={root:resolve(ROOT,'apps/client'),configFile:resolve(ROOT,'apps/client/vite.config.ts'),build:{outDir:resolve(HERE,'dist/preview'),emptyOutDir:true,rollupOptions:{input:resolve(HERE,'preview.html')}}};
  await build(options);server=await preview({...options,preview:{host:'127.0.0.1',port:5211,strictPort:true}});
  const browserPath=process.env.CHROME_PATH??(process.env.PATH??'').split(delimiter).flatMap(d=>['google-chrome','chromium','chromium-browser'].map(n=>resolve(d,n))).find(existsSync);
  assert.ok(browserPath,'Chrome/Chromium is required; no skipped browser gate');
  profile=mkdtempSync(resolve(HERE,'dist/profile-'));
  browser=spawn(browserPath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-extensions','--use-angle=swiftshader','--enable-unsafe-swiftshader',...(process.env.CI?['--no-sandbox']:[]),'about:blank'],{stdio:'ignore'});
  browser.on('error',e=>report.errors.push(e.message));
  const port=await until('browser startup',()=>{if(browser.exitCode!==null)throw new Error(`Chrome exited ${browser.exitCode}`);const p=resolve(profile,'DevToolsActivePort');return existsSync(p)?readFileSync(p,'utf8').split('\n')[0]:null;});
  report.browser=(await(await fetch(`http://127.0.0.1:${port}/json/version`)).json()).Browser;
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
  let seq=0;const pending=new Map();
  send=(method,params={})=>new Promise((res,rej)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);rej(new Error(`CDP timeout ${method}`));},10000);pending.set(id,m=>{clearTimeout(timer);m.error?rej(new Error(m.error.message)):res(m.result);});ws.send(JSON.stringify({id,method,params}));});
  ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){pending.get(m.id)?.(m);pending.delete(m.id);return;}const p=m.params??{};
    if(m.method==='Runtime.exceptionThrown')report.errors.push(p.exceptionDetails?.exception?.description??p.exceptionDetails?.text);
    if(m.method==='Log.entryAdded'&&p.entry?.level==='error')report.errors.push(p.entry.text);
    if(m.method==='Runtime.consoleAPICalled'&&p.type==='error')report.errors.push(p.args.map(a=>a.value??a.description).join(' '));
  });
  const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result?.value;};
  const snapshot=()=>evaluate('window.__streetPreview.snapshot()');
  const ready=()=>until('street ready',async()=>{const s=await evaluate('document.documentElement?.dataset.streetState');if(s==='failed')throw new Error((await snapshot()).failure);return s==='ready';});
  const screenshot=async(name)=>{const s=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(RESULTS,`${name}.png`),Buffer.from(s.data,'base64'));};
  await send('Runtime.enable');await send('Log.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:URL});await ready();
  for(const quality of ['low','medium'])for(let view=0;view<3;view++){
    await evaluate(`window.__streetPreview.chooseQuality('${quality}');window.__streetPreview.chooseView(${view})`);
    const start=(await snapshot()).frames;await until('rendered measurement frames',async()=>(await snapshot()).frames>=start+35,60000);
    const s=await snapshot();assert.equal(s.worldVersion,'first-street-1');assert.equal(s.failure,null);assert.ok(s.drawCalls>0);assert.ok(s.costs.triangles>0);assert.ok(s.anchors.includes('c-bank'));
    if(quality==='low'){assert.equal(s.costs.shadowMapSize,0);assert.ok(s.costs.triangles<250000);assert.ok(s.drawCalls<120,'low draw-call target');}else assert.equal(s.costs.shadowMapSize,1024);
    report.renderer=s.renderer;report.views.push(s);await screenshot(`${quality}-${view}`);console.log(`PASS ${quality} ${s.view}: ${s.drawCalls} draws, ${s.costs.triangles} scene triangles`);
  }
  assert.ok(report.views.find(v=>v.quality==='medium').costs.triangles>report.views.find(v=>v.quality==='low').costs.triangles);
  const before=await snapshot();await evaluate('window.__streetPreview.unload()');const unloaded=await snapshot();assert.equal(unloaded.sceneMeshes,1,'only the provisional marker remains after unload');
  await evaluate('window.__streetPreview.reload()');await ready();const reloaded=await snapshot();
  for(const key of ['sceneMeshes','sceneMaterials','sceneTextures'])assert.equal(reloaded[key],before[key],`reload must restore ${key} without leaks`);
  report.steps.push({name:'Reload restores mesh/material/texture counts',before:{meshes:before.sceneMeshes,materials:before.sceneMaterials,textures:before.sceneTextures},unloaded:{meshes:unloaded.sceneMeshes,materials:unloaded.sceneMaterials,textures:unloaded.sceneTextures},reloaded:{meshes:reloaded.sceneMeshes,materials:reloaded.sceneMaterials,textures:reloaded.sceneTextures}});
  await evaluate('window.__streetPreview.shutdown()');const final=await snapshot();assert.equal(final.sceneMeshes,0);assert.equal(final.sceneMaterials,0);assert.equal(final.sceneTextures,0);report.steps.push('Shutdown releases all scene assets');
  assert.deepEqual(report.errors,[]);report.ok=true;
}catch(e){report.failure=e instanceof Error?e.message:String(e);console.error(report.failure);process.exitCode=1;if(send)try{const s=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(RESULTS,'failure.png'),Buffer.from(s.data,'base64'));}catch{}}
finally{clearTimeout(total);await stop();writeFileSync(resolve(RESULTS,'browser.json'),JSON.stringify(report,null,2)+'\n');}
