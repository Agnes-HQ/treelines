import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// the examples import the package by its name, as users do
export default defineConfig({
  resolve: {
    alias: [
      { find: /^treelines\/core$/, replacement: fileURLToPath(new URL("./src/core.ts", import.meta.url)) },
      { find: /^treelines$/, replacement: fileURLToPath(new URL("./src/index.ts", import.meta.url)) },
    ],
  },
  test: { include: ["test/**/*.test.{ts,tsx}"] },
});
