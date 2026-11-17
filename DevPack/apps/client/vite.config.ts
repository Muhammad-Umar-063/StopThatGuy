import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  // Bundle workspace packages (e.g. @stopthatguy/shared) from TypeScript source in dev and build.
  resolve: { conditions: ["stopthatguy-source", ...defaultClientConditions] },
  // Isolated T012 fixture entry; main remains the existing smoke scene.
  build: { rollupOptions: { input: { main: "index.html", lobby: "src/ui/lobby/demo.html" } } },
  // Build inputs otherwise narrow the dev scan and trigger late asset-demo reloads.
  optimizeDeps: { entries: ["index.html", "src/**/*.html"] },
  // Default ports; Vite picks the next free port if one is taken.
  server: { port: 5173 },
  preview: { port: 4173 },
});
