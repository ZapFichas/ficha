import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  server: {
    fs: {
      // Permite importar os templates do monorepo em modo demo.
      allow: [fileURLToPath(new URL("../..", import.meta.url))],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
  },
});
