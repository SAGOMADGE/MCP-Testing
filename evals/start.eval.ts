import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

// Only the database boundary is mocked; registration, schemas and tool handlers are real.
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("dotenv/config", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: database.from }),
}));

const client = new Client({ name: "shopping-cart-local-eval", version: "1.0.0" });
let handler: ReturnType<typeof createMcpHandler> | undefined;

beforeAll(async () => {
  vi.stubEnv("SUPABASE_URL", "https://supabase.invalid");
  vi.stubEnv("SUPABASE_SECRET_KEY", "local-test-only");
  vi.stubEnv("DEMO_CART_ID", "local-test-cart");
  vi.stubGlobal("fetch", vi.fn(() => {
    throw new Error("External network is disabled in local evals");
  }));

  const { app } = await import("../src/server.js");
  const localHandler = createMcpHandler(() => app.createServerInstance());
  handler = localHandler;
  await client.connect(new StreamableHTTPClientTransport(
    new URL("http://shopping-cart.test/mcp"),
    { fetch: (url, init) => localHandler.fetch(new Request(url, init)) },
  ));
});

beforeEach(() => database.from.mockReset());

afterAll(async () => {
  try {
    await client.close();
    await handler?.close();
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

// Test fixtures never become an application catalog or touch a real database.
const product = {
  id: 1,
  title: "Catalog contract fixture",
  price: 19.99,
  image: "https://example.invalid/product.png",
  category: "fixture-category",
};

function catalogResponse(data: unknown[], error: { message: string } | null = null) {
  database.from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error }),
  });
}

it("registers the shopping tools and connects the catalog tool to its MCP view", async () => {
  const { tools } = await client.listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "add-to-cart", "get-cart", "get-product-details", "get-products",
    "remove-from-cart", "update-cart-item",
  ]);
  const catalog = tools.find((tool) => tool.name === "get-products");
  expect(catalog?.annotations?.readOnlyHint).toBe(true);
  expect(catalog?._meta?.ui).toMatchObject({
    resourceUri: expect.stringMatching(/^ui:\/\/views\/ext-apps\/products\.html/),
  });
  const { resources } = await client.listResources();
  expect(resources).toEqual(expect.arrayContaining([
    expect.objectContaining({ uri: catalog?._meta?.["ui/resourceUri"] }),
  ]));
  expect(database.from).not.toHaveBeenCalled();
});

it("returns catalog data through the actual get-products handler", async () => {
  catalogResponse([product]);
  const result = await client.callTool({ name: "get-products", arguments: {} });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toEqual({ products: [product] });
  expect(result.content).toContainEqual({ type: "text", text: JSON.stringify([product]) });
  expect(database.from).toHaveBeenCalledWith("products");
});

it("returns an empty catalog without inventing products", async () => {
  catalogResponse([]);
  const result = await client.callTool({ name: "get-products", arguments: {} });
  expect(result.isError).not.toBe(true);
  expect(result.structuredContent).toEqual({ products: [] });
});

it("reports a catalog database error as an MCP tool error", async () => {
  catalogResponse([], { message: "Catalog unavailable" });
  const result = await client.callTool({ name: "get-products", arguments: {} });
  expect(result.isError).toBe(true);
  expect(result.structuredContent?.products).toBeUndefined();
  expect(result.content).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "text", text: expect.stringContaining("Catalog unavailable") }),
  ]));
});

it("rejects malformed catalog data instead of returning an invalid view payload", async () => {
  catalogResponse([{ ...product, price: "not-a-number" }]);
  const result = await client.callTool({ name: "get-products", arguments: {} });
  expect(result.isError).toBe(true);
  expect(result.structuredContent?.products).toBeUndefined();
});

it.each([
  ["add-to-cart", { productId: 1, quantity: 0 }],
  ["update-cart-item", { productId: 1, quantity: 1.5 }],
  ["remove-from-cart", { productId: -1 }],
])("rejects invalid %s input before accessing the database", async (name, args) => {
  const result = await client.callTool({ name, arguments: args });
  expect(result.isError).toBe(true);
  expect(database.from).not.toHaveBeenCalled();
});
