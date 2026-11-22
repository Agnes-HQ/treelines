import { defineConfig } from "tsup";

// Two entries: `treelines` (the React parts and the core) is a client module, so it starts with "use client" for React
// Server Components; `treelines/core` (the layout alone) is not, so server code can call it.
const shared = { format: ["esm", "cjs"] as ("esm" | "cjs")[], dts: true, target: "es2022", external: ["react"], sourcemap: true };

export default defineConfig([
  // the two run side by side: `npm run build` empties dist first, so neither cleans away the other's files
  { ...shared, entry: { core: "src/core.ts" } },
  { ...shared, entry: { index: "src/index.ts" }, banner: { js: '"use client";' } },
]);
