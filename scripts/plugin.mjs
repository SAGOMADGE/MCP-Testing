import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, lstatSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync } from "fflate";
import { parse as parseYaml } from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));
const plugin = "plugins/shopping-cart/";
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path).toString("utf8"));
const write = (path, bytes) => {
  const destination = resolve(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
};
const serialize = value => JSON.stringify(value, null, 2) + "\n";
const manifest = json(plugin + "plugin.json");
const mcp = json(plugin + "mcp.json");
const iface = manifest.extensions["com.openai"].interface;
const endpoint = "https://mcp-testing-5679d679.alpic.live/mcp";
const skillPath = "skills/shopping-assistant/SKILL.md";
const legacy = {
  name: manifest.name, version: manifest.version, description: manifest.description,
  skills: "./skills/", mcpServers: "./.mcp.json", interface: iface,
};
const legacyMcp = { mcpServers: { "shopping-cart": { type: "http", url: endpoint } } };
const generated = {
  ".codex-plugin/plugin.json": serialize(legacy),
  ".mcp.json": serialize(legacyMcp),
  [skillPath]: read("src/" + skillPath).toString("utf8"),
};
const action = process.argv[2] ?? "check";
assert(["sync", "check", "package"].includes(action), "Use sync, check or package");
if (action === "sync") for (const [path, value] of Object.entries(generated)) write(plugin + path, value);

// Validate effective portable configuration and compatibility overlay separately.
assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
assert.equal(manifest.name, "shopping-cart");
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert(iface.shortDescription.length <= 30);
assert.equal(iface.category, "Productivity");
assert(Array.isArray(iface.capabilities));
assert(!("apps" in manifest.extensions["com.openai"]));
assert.equal(mcp.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
assert.deepEqual(Object.keys(mcp.mcpServers), ["shopping-cart"]);
assert.deepEqual(mcp.mcpServers["shopping-cart"], {
  type: "streamable-http", url: endpoint,
});
for (const [path, value] of Object.entries(generated)) {
  assert.equal(read(plugin + path).toString("utf8"), value, `${path} drifted; run npm run plugin:sync`);
}
const skill = read(plugin + skillPath).toString("utf8");
const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
assert(frontmatter, "Skill YAML frontmatter missing");
const metadata = parseYaml(frontmatter[1]);
assert.equal(metadata.name, "shopping-assistant");
assert.equal(typeof metadata.description, "string");
assert(metadata.description.trim().length > 0);
const marketplace = json(".agents/plugins/marketplace.json");
assert(marketplace.plugins.some(p => p.name === manifest.name && p.source.path === "./plugins/shopping-cart"));

const packagePaths = ["plugin.json", "mcp.json", ".codex-plugin/plugin.json", ".mcp.json", skillPath];
const packageFiles = Object.fromEntries(packagePaths.map(path => {
  assert(lstatSync(resolve(root, plugin, path)).isFile(), `Not a regular file: ${path}`);
  return [`shopping-cart/${path}`, read(plugin + path)];
}));
function validateContents(files) {
  for (const [path, bytes] of Object.entries(files)) {
    assert(!path.includes("..") && !path.startsWith("/") && !path.includes("\\"), `Unsafe path: ${path}`);
    assert(!/(^|\/)(\.app\.json|\.env(?:\..*)?|node_modules|\.git)(\/|$)/.test(path), `Forbidden file: ${path}`);
    if (/\.(json|md|toml|ts|tsx|mjs|ya?ml)$/.test(path)) {
      const content = Buffer.from(bytes).toString("utf8");
      assert(!/(?:asdk_app_|plugin_asdk_app_)[a-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(content), `Account ID or credential in ${path}`);
    }
  }
}
validateContents(packageFiles);
console.log("PASS: portable + Codex manifests, endpoint, no auth, Skill YAML/sync, marketplace, no account binding");
if (action !== "package") process.exit(0);

const version = manifest.version;
const artifacts = [];
function archive(name, files) {
  validateContents(files);
  const input = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, "en")).map(([path, bytes]) =>
    [path, [new Uint8Array(bytes), { mtime: new Date(2020, 0, 1), os: 3, attrs: 0o100644 << 16 }]]));
  const bytes = zipSync(input, { level: 9 });
  const extracted = unzipSync(bytes);
  assert.deepEqual(Object.keys(extracted).sort(), Object.keys(files).sort());
  for (const [path, value] of Object.entries(files)) assert.deepEqual(Buffer.from(extracted[path]), Buffer.from(value));
  write(`artifacts/${name}`, bytes);
  artifacts.push({ name, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, files: Object.keys(extracted).length });
  return bytes;
}
const pluginZip = archive(`shopping-cart-${version}.zip`, packageFiles);
// A second ZIP is an explicitly separate Skill attachment, not a complete plugin.
archive(`shopping-assistant-${version}.zip`, { [skillPath]: read(plugin + skillPath) });
const marketplaceFiles = {
  "codex-marketplace/.agents/plugins/marketplace.json": read(".agents/plugins/marketplace.json"),
  ...Object.fromEntries(Object.entries(packageFiles).map(([p, b]) => [`codex-marketplace/plugins/${p}`, b])),
};
for (const [path, bytes] of Object.entries(marketplaceFiles)) write(`artifacts/${path}`, bytes);
const docs = ["README-NUGZAR.md", "INSTALL-CHATGPT.md", "INSTALL-CODEX.md", "VALIDATION.md", "ARCHITECTURE.md", "RELEASE.md", "evidence/acceptance.json"];
const handoff = { ...marketplaceFiles, [`shopping-cart-${version}.zip`]: pluginZip,
  [`shopping-assistant-${version}.zip`]: read(`artifacts/shopping-assistant-${version}.zip`) };
for (const doc of docs) handoff[doc] = read(`docs/${doc}`);
handoff["fallback/codex-mcp.toml"] = read("config/codex-mcp.toml");
archive(`shopping-cart-handoff-${version}.zip`, handoff);

// Source snapshot: use Git's inventory, but a strict project allowlist; never zip
// the whole workspace, personal app bindings, .env, caches, or generated builds.
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root }).toString().split("\0").filter(Boolean);
const source = {};
for (const path of new Set(tracked)) {
  if (!/^(src\/|scripts\/|tests\/|evals\/|docs\/|config\/|plugins\/shopping-cart\/|\.agents\/plugins\/marketplace\.json$|(?:AGENTS|SPEC|README)\.md$|(?:package(?:-lock)?|tsconfig(?:\.evals)?|alpic)\.json$|(?:vite|vitest)\.config\.ts$|Dockerfile$|\.dockerignore$|\.gitignore$|\.env\.example$)/.test(path)) continue;
  if (path.startsWith(plugin) && !packagePaths.includes(path.slice(plugin.length))) continue;
  if (path === ".env.example" || !existsSync(resolve(root, path))) continue;
  assert(lstatSync(resolve(root, path)).isFile(), `Not a regular source file: ${path}`);
  source[`shopping-cart-source/${path}`] = read(path);
}
archive(`shopping-cart-source-${version}.zip`, source);
write("artifacts/SHA256SUMS.txt", artifacts.map(a => `${a.sha256}  ${a.name}`).join("\n") + "\n");
write("artifacts/package-report.json", serialize({ version, endpoint, artifacts }));
console.log(JSON.stringify(artifacts, null, 2));
