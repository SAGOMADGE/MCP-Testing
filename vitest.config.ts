import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Deliberately avoid the app's Vite plugins and paid model evals.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 15000 },
});
