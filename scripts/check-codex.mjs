// Optional acceptance probe for an installed Codex CLI. No model calls, account
// credentials, global config edits or production cart writes.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const executable = process.argv[2] || "codex";
const root = process.cwd();
mkdirSync(".delivery-work", { recursive: true });
const testCodexRoot = mkdtempSync(resolve(".delivery-work/codex-"));
// Only child processes receive this temporary home. The user's environment,
// real ~/.codex/config.toml, installed plugins and auth files remain untouched.
const testEnv = { ...process.env, CODEX_HOME: testCodexRoot };
const marketplaceRoot = resolve("artifacts/codex-marketplace");
const command = args => execFileSync(executable, args, {
  cwd: marketplaceRoot, env: testEnv, encoding: "utf8", timeout: 45000,
  windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
});
const report = { timestamp: new Date().toISOString(), version: command(["--version"]).trim(), checks: [], writesExecuted: false };
const pass = (name, detail) => { report.checks.push({ name, status: "PASS", detail }); console.log(`PASS: ${name}`); };
let child;
let diagnostics = "";
try {
  const added = JSON.parse(command(["plugin", "marketplace", "add", marketplaceRoot, "--json"]));
  pass("marketplace add", added);
  const installed = JSON.parse(command(["plugin", "add", "shopping-cart@shopping-cart-local", "--json"]));
  pass("plugin install", installed);
  const listed = JSON.parse(command(["plugin", "list", "--marketplace", "shopping-cart-local", "--json"]));
  pass("plugin list", listed);

  child = spawn(executable, ["app-server", "--stdio"], { cwd: marketplaceRoot, env: testEnv, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", chunk => { diagnostics += chunk.toString(); });
  const pending = new Map();
  let counter = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", line => {
    let response; try { response = JSON.parse(line); } catch { return; }
    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);
    clearTimeout(waiter.timer);
    if (response.error) waiter.reject(new Error(JSON.stringify(response.error)));
    else waiter.resolve(response.result);
  });
  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 45000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
  });
  await rpc("initialize", { clientInfo: { name: "shopping_cart_acceptance", version: "1.0.2" }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
  const plugin = await rpc("plugin/read", { marketplacePath: resolve(marketplaceRoot, ".agents/plugins/marketplace.json"), pluginName: "shopping-cart" });
  pass("app-server plugin/read", plugin);
  const skills = await rpc("skills/list", { cwds: [marketplaceRoot], forceReload: true });
  const skillText = JSON.stringify(skills);
  assert(skillText.includes("shopping-assistant"), "Installed Skill not discovered");
  const installedSkill = skills.data.flatMap(entry => entry.skills).find(skill => skill.pluginId === "shopping-cart@shopping-cart-local");
  assert(installedSkill?.enabled);
  assert(installedSkill.path.startsWith(testCodexRoot));
  assert.equal(readFileSync(installedSkill.path, "utf8"), readFileSync(resolve(root, "src/skills/shopping-assistant/SKILL.md"), "utf8"));
  pass("installed Skill discovery and content", { name: installedSkill.name, path: installedSkill.path });
  const servers = await rpc("mcpServerStatus/list", {});
  const server = servers.data?.find(s => s.name.includes("shopping") || JSON.stringify(s.tools).includes("get-products"));
  assert(server, `Plugin MCP server not discovered: ${JSON.stringify(servers)}`);
  const names = Object.keys(server.tools ?? {});
  for (const name of ["get-products", "get-product-details", "get-cart", "add-to-cart", "update-cart-item", "remove-from-cart"]) {
    assert(names.some(n => n.endsWith(name) || n.endsWith(name.replaceAll("-", "_"))), `Missing tool ${name}`);
  }
  pass("Codex MCP discovery", { name: server.name, tools: names });
  const thread = await rpc("thread/start", { cwd: marketplaceRoot, ephemeral: true });
  // No turn/start: no LLM inference or paid model usage. Only the named read tool.
  const catalog = await rpc("mcpServer/tool/call", {
    threadId: thread.thread.id, server: server.name, tool: "get-products", arguments: {},
  });
  assert(!catalog.isError, "Codex catalog call failed");
  const payload = catalog.structuredContent ?? catalog.result?.structuredContent;
  assert(payload?.products?.length > 0, `No catalog through Codex: ${JSON.stringify(catalog).slice(0,500)}`);
  pass("Codex get-products execution", { productCount: payload.products.length });
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = error.message;
  report.diagnostics = diagnostics;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  child?.kill();
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(resolve(root, "artifacts/codex-check.json"), JSON.stringify(report, null, 2) + "\n");
}
