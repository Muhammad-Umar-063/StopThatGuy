import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
  // Bundle workspace packages (e.g. @stopthatguy/shared) from TypeScript source in dev and build.
  resolve: { conditions: ["stopthatguy-source", ...defaultClientConditions] },
  // Default ports; Vite picks the next free port if one is taken.
  server: { port: 5173 },
  preview: { port: 4173 },
});
