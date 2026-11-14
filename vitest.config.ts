import { defineConfig } from "vitest/config";

// Run local MCP contract checks without the Vite plugin loading .env or model APIs.
export default defineConfig({
  envDir: false,
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
  },
});
