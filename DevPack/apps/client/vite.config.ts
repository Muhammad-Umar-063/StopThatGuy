import { defineConfig } from "vite";

export default defineConfig({
  // Default ports; Vite picks the next free port if one is taken.
  server: { port: 5173 },
  preview: { port: 4173 },
});
