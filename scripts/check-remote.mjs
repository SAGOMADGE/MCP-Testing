import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const endpoint = "https://mcp-testing-5679d679.alpic.live/mcp";
const client = new Client({ name: "shopping-cart-readonly-check", version: "1.0.2" }, {
  capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } },
});
const report = { endpoint, timestamp: new Date().toISOString(), writesExecuted: false, checks: [] };
const record = (name, detail) => { report.checks.push({ name, status: "PASS", detail }); console.log(`PASS: ${name}`); };
// This allowlist is the sole callTool entrypoint. No write probes, including invalid writes.
async function readTool(name, args = {}) {
  assert(["get-products", "get-product-details", "get-cart"].includes(name));
  const result = await client.callTool({ name, arguments: args });
  assert(!result.isError, `${name} returned an MCP error`);
  assert(result.content?.some(c => c.type === "text"));
  return result.structuredContent;
}
const timer = setTimeout(() => { console.error("Remote verification timed out"); process.exit(1); }, 90000);
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  record("initialize", client.getServerVersion());
  const { tools } = await client.listTools();
  const expected = ["get-products", "get-product-details", "get-cart", "add-to-cart", "update-cart-item", "remove-from-cart"];
  for (const name of expected) assert(tools.some(t => t.name === name), `Missing tool: ${name}`);
  record("tools/list", { businessTools: expected, extraTools: tools.map(t => t.name).filter(n => !expected.includes(n)) });
  const catalogTool = tools.find(t => t.name === "get-products");
  const uri = catalogTool._meta?.ui?.resourceUri ?? catalogTool._meta?.["openai/outputTemplate"];
  assert(uri?.startsWith("ui://"), "Missing catalog view resource");
  const catalog = await readTool("get-products");
  assert(catalog.products.length > 0 && catalog.products.length <= 20);
  record("get-products", { count: catalog.products.length });
  const id = catalog.products[0].id;
  const details = await readTool("get-product-details", { productId: id });
  assert.equal(details.product.id, id);
  assert(details.relatedProducts.length <= 3);
  record("get-product-details", { productId: id, relatedCount: details.relatedProducts.length });
  const cart = await readTool("get-cart");
  assert(Array.isArray(cart.items));
  // Do not store contents/identifiers of the shared cart in the report.
  record("get-cart", { itemCount: cart.items.length });
  const resource = await client.readResource({ uri });
  const htmlResource = resource.contents.find(c => typeof c.text === "string" && c.mimeType?.startsWith("text/html"));
  assert(htmlResource, "Missing HTML view");
  const html = htmlResource.text;
  assert(html.includes("<script"));
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1])
    .filter(u => u.startsWith("http") && /\.(js|css)(?:\?|$)/.test(u));
  assert(assets.length > 0, "No remotely served JS/CSS assets");
  for (const asset of assets) {
    assert.equal(new URL(asset).origin, new URL(endpoint).origin, "Unexpected asset origin");
    const response = await fetch(asset, { signal: AbortSignal.timeout(20000) });
    assert(response.ok, `Asset HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    assert(bytes.byteLength > 0);
  }
  record("React resource and hosted assets", { uri, mimeType: htmlResource.mimeType, assetCount: assets.length, metadata: htmlResource._meta });
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await client.close(); clearTimeout(timer);
  mkdirSync("artifacts", { recursive: true });
  writeFileSync("artifacts/remote-check.json", JSON.stringify(report, null, 2) + "\n");
}
