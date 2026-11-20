import { defineConfig } from "vitest/config";

// Deliberately avoid the app's Vite plugins and paid model evals.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], testTimeout: 15000 },
});
