// Isolated entry: global Vite configuration remains T018-owned.
import {defineConfig,defaultClientConditions} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const missingFileFixture=server=>{server.middlewares.use((req,res,next)=>{if(req.url?.startsWith('/deliberately-missing/')){res.statusCode=404;res.setHeader('Content-Type','text/plain');res.end('Intentional missing vehicle fixture');}else next();});};
export default defineConfig({plugins:[{name:'vehicle-missing-file-fixture',configureServer:missingFileFixture,configurePreviewServer:missingFileFixture}],cacheDir:resolve(here,'../../../../../test-results/vehicles/vite-cache'),root:resolve(here,'../../..'),resolve:{conditions:['stopthatguy-source',...defaultClientConditions]},build:{outDir:resolve(here,'../../../../../test-results/vehicles/build'),emptyOutDir:true,rollupOptions:{input:resolve(here,'preview.html')}},optimizeDeps:{entries:[resolve(here,'preview.html')]},server:{host:'127.0.0.1',port:5219,strictPort:true},preview:{host:'127.0.0.1',port:5219,strictPort:true}});
