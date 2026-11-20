import { anthropic } from "@ai-sdk/anthropic";
import { start } from "@skybridge/test";
import { expect, it } from "vitest";
import { app } from "../src/server.js";

// Explicit opt-in: this uses a paid model API. Block every write even if the
// model ignores the prompt. The regular test suite uses no model API or network.
app.withMcpMiddleware({ filter: "tools/call", handler: async (message, _extra, next) => {
  if (message.method === "tools/call") {
    const name = (message.params as { name?: string } | undefined)?.name;
    if (!["get-products", "get-product-details", "get-cart"].includes(name ?? "")) {
      throw new Error("Read-only evaluation: write tools are blocked");
    }
  }
  return next();
} });

it.skipIf(process.env.RUN_MODEL_EVALS !== "1")("uses the catalog for a shopping recommendation", async () => {
  const chat = await start({ app, model: anthropic("claude-sonnet-4-5") });
  try {
    await chat.send("Show the available shopping catalog and suggest one item under $30. Do not change the cart.");
    expect.chat(chat).toHaveCalledToolOnce("get-products");
  } finally {
    await chat.close();
  }
});
