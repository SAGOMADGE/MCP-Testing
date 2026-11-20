import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "dotenv";

assert(existsSync("dist/__entry.js"), "Run npm run build first");
const manifest = JSON.parse(readFileSync("dist/assets/.vite/manifest.json", "utf8"));
assert(Object.keys(manifest).some(key => key.includes("products")), "React catalog absent from build");
const env = existsSync(".env") ? parse(readFileSync(".env")) : {};
const secret = env.SUPABASE_SECRET_KEY;
let files = 0;
function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else {
      const content = readFileSync(path, "utf8");
      assert(!secret || !content.includes(secret), `Server key leaked into ${path}`);
      assert(!/SUPABASE_SECRET_KEY|DEMO_CART_ID|sb_secret_[A-Za-z0-9_-]+/.test(content), `Server-only config in ${path}`);
      files++;
    }
  }
}
check("dist/assets");
console.log(`PASS: production entry, React manifest, ${files} asset files checked for server-only config and key leakage`);
