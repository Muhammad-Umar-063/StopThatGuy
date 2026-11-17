// Owned standalone entry; leaves bootstrap, Vite config and package scripts unchanged.
import { build, createServer, preview } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const cameraDir = resolve(here, '..');
export const root = resolve(here, '../../../../..');
export const previewUrl = 'http://127.0.0.1:5210/src/camera/browser/demo.html';
export async function startPreview(dev = false) {
  const options = { configFile: resolve(root, 'apps/client/vite.config.ts'), root: resolve(root, 'apps/client') };
  if (dev) {
    const server = await createServer({ ...options, server: { host: '127.0.0.1', port: 5210, strictPort: true } });
    await server.listen();
    return () => server.close();
  }
  const outDir = resolve(cameraDir, '.preview-dist');
  await build({ ...options, build: { outDir, emptyOutDir: true, rollupOptions: { input: resolve(here, 'demo.html') } } });
  const server = await preview({ ...options, build: { outDir }, preview: { host: '127.0.0.1', port: 5210, strictPort: true } });
  return () => new Promise((done, reject) => server.httpServer.close((error) => error ? reject(error) : done()));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const close = await startPreview(process.argv.includes('--dev'));
  console.log(`Camera fixture preview: ${previewUrl}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close().then(() => process.exit(0)); });
}
