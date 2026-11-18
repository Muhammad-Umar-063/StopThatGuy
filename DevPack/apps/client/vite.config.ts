import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  // Bundle workspace packages (e.g. @stopthatguy/shared) from TypeScript source in dev and build.
  resolve: { conditions: ["stopthatguy-source", ...defaultClientConditions] },
  // Isolated lobby fixture and live-network acceptance entries.
  build: { rollupOptions: { input: { main: "index.html", lobby: "src/ui/lobby/demo.html", network: "src/network/browser/demo.html" } } },
  // Build inputs otherwise narrow the dev scan and trigger late asset-demo reloads.
  optimizeDeps: { entries: ["index.html", "src/**/*.html"] },
  // Default ports; Vite picks the next free port if one is taken.
  server: { port: 5173 },
  preview: { port: 4173 },
});
