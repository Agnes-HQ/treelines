import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The demo page, published on GitHub Pages at /treelines/. It imports treelines from this repository's source, so it
// always shows the code as it is on main.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/treelines/",
  publicDir: fileURLToPath(new URL("../assets", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^treelines\/core$/, replacement: fileURLToPath(new URL("../src/core.ts", import.meta.url)) },
      { find: /^treelines$/, replacement: fileURLToPath(new URL("../src/index.ts", import.meta.url)) },
    ],
  },
  build: { outDir: "dist", emptyOutDir: true },
});
