import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cart: new Map<number, number>(), calls: 0, fail: false,
  products: [
    { id: 1, title: "Backpack", price: 25, category: "bags", image: "https://example.com/bag.png", description: "A bag" },
    { id: 2, title: "Small bag", price: 10, category: "bags", image: "https://example.com/small.png", description: "Small" },
  ],
}));
vi.mock("dotenv/config", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from(table: string) {
    db.calls++;
    let operation = "select", columns = "", payload: Record<string, number> = {};
    const filters: Record<string, unknown> = {};
    let excludeId: number | undefined;
    const query = {
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      neq(_key: string, value: number) { excludeId = value; return query; },
      order() { return query; }, limit() { return query; },
      upsert(value: Record<string, number>) { operation = "upsert"; payload = value; return query; },
      update(value: Record<string, number>) { operation = "update"; payload = value; return query; },
      delete() { operation = "delete"; return query; },
      async maybeSingle() { return resolve(true); },
      async single() { return resolve(true, true); },
      then(fulfilled: (result: ReturnType<typeof resolve>) => unknown, rejected?: (error: unknown) => unknown) {
        return Promise.resolve(resolve(false)).then(fulfilled, rejected);
      },
    };
    function resolve(single: boolean, required = false) {
      if (db.fail) return { data: null, error: { message: "Simulated database failure" } };
      if (table === "products") {
        const rows = db.products.filter(p => (filters.id === undefined || p.id === filters.id)
          && (filters.category === undefined || p.category === filters.category) && p.id !== excludeId);
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
      // Catch accidental loss of cart scoping in any write/read path.
      if (operation === "upsert") expect(payload.cart_id).toBe("isolated-test-cart");
      else expect(filters.cart_id).toBe("isolated-test-cart");
      const id = Number(filters.product_id ?? payload.product_id);
      const previous = db.cart.get(id);
      if (operation === "upsert" || (operation === "update" && previous !== undefined)) db.cart.set(id, payload.quantity);
      if (operation === "delete") db.cart.delete(id);
      if (operation === "select" && !single) return {
        data: [...db.cart].map(([product_id, quantity]) => ({ product_id, quantity, products: db.products.find(p => p.id === product_id) })), error: null,
      };
      const quantity = operation === "delete" ? previous : db.cart.get(id);
      if (quantity === undefined) return { data: null, error: required ? { message: "Row not found" } : null };
      return { data: columns === "quantity" ? { quantity } : { product_id: id, quantity }, error: null };
    }
    return query;
  } }),
}));

let client: Client;
beforeAll(async () => {
  vi.stubEnv("SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-placeholder");
  vi.stubEnv("DEMO_CART_ID", "isolated-test-cart");
  vi.stubGlobal("fetch", () => { throw new Error("Network forbidden in unit tests"); });
  const { app } = await import("../src/server.js");
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "isolated-contract-test", version: "1.0.0" });
  await app.connect(serverTransport);
  await client.connect(clientTransport);
});
beforeEach(() => { db.cart.clear(); db.calls = 0; db.fail = false; });
afterAll(async () => { await client?.close(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const call = (name: string, args = {}) => client.callTool({ name, arguments: args });

it("advertises all six business tools and the React resource", async () => {
  const { tools } = await client.listTools();
  expect(tools.map(t => t.name)).toEqual(expect.arrayContaining([
    "get-products", "get-product-details", "get-cart", "add-to-cart", "update-cart-item", "remove-from-cart",
  ]));
  const catalog = tools.find(t => t.name === "get-products")!;
  expect(catalog.annotations?.readOnlyHint).toBe(true);
  expect(JSON.stringify(catalog._meta)).toContain("ui://");
  expect(tools.find(t => t.name === "add-to-cart")?.annotations?.idempotentHint).toBe(false);
  expect(tools.find(t => t.name === "update-cart-item")?.annotations?.destructiveHint).toBe(true);
});
it("reads catalog, details, related products and empty cart", async () => {
  expect((await call("get-products")).structuredContent).toMatchObject({ products: [{ id: 1 }, { id: 2 }] });
  expect((await call("get-product-details", { productId: 1 })).structuredContent).toMatchObject({ product: { id: 1 }, relatedProducts: [{ id: 2 }] });
  expect((await call("get-cart")).structuredContent).toEqual({ items: [] });
});
it("adds, increments, replaces and removes quantities in the isolated cart", async () => {
  expect((await call("add-to-cart", { productId: 1, quantity: 2 })).structuredContent).toMatchObject({ quantity: 2, saved: true });
  expect((await call("add-to-cart", { productId: 1, quantity: 3 })).structuredContent).toMatchObject({ quantity: 5 });
  expect((await call("update-cart-item", { productId: 1, quantity: 1 })).structuredContent).toMatchObject({ quantity: 1 });
  expect((await call("get-cart")).structuredContent).toMatchObject({ items: [{ product_id: 1, quantity: 1 }] });
  expect((await call("remove-from-cart", { productId: 1 })).structuredContent).toEqual({ productId: 1, removed: true });
  expect((await call("get-cart")).structuredContent).toEqual({ items: [] });
});
it.each([0, -1, 1.5, "2"])("rejects invalid quantity %s before touching the backend", async quantity => {
  for (const name of ["add-to-cart", "update-cart-item"]) {
    expect((await call(name, { productId: 1, quantity })).isError).toBe(true);
  }
  expect(db.calls).toBe(0);
});
it("reports missing products and missing cart rows without claiming success", async () => {
  for (const [name, args] of [
    ["get-product-details", { productId: 999 }],
    ["update-cart-item", { productId: 999, quantity: 1 }],
    ["remove-from-cart", { productId: 999 }],
  ] as const) expect((await call(name, args)).isError).toBe(true);
});
it("propagates database failures as MCP errors", async () => {
  db.fail = true;
  for (const name of ["get-products", "get-product-details", "get-cart", "add-to-cart", "update-cart-item", "remove-from-cart"]) {
    const result = await call(name, { productId: 1, quantity: 1 });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  }
});
