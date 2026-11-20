# Shopping Cart MCP — delivery specification

## Agreed scope

Prepare the existing Skybridge 2 / React / TypeScript / Supabase demo for Nugzar.
Browse the real catalog, inspect product details, and manage the shared demo cart
through conversation and the existing React view. The assistant interprets intent;
the six MCP tools supply facts and perform explicitly requested cart operations.
Scenario Modeler remains a client-side preview, not a seventh business tool.

Catalog additions track pending requests per product ID: only that product's
button is busy, duplicate in-flight additions are blocked, and other products
can be added concurrently. Success and errors both release the product lock.

The user has authorized implementation and verification, not another discovery
cycle. Preserve the running server, data, UI and installed TEST plugin. Do not
publish publicly, create paid resources, or mutate the production cart in tests.

## Architecture and delivery

- One existing endpoint: https://mcp-testing-5679d679.alpic.live/mcp
- Alpic hosts the server and compiled React view; Supabase stays server-side.
- Portable plugin: Agent Plugins 1.0 root plugin.json, mcp.json and bundled Skill.
- Codex compatibility overlay and repo marketplace use the same endpoint/Skill.
- Exclude personal .app.json and all account IDs from distributed artifacts.
- Keep the existing locally edited .app.json untouched as legacy account metadata.
- A ZIP import, plugin installation, MCP connection, tool call, and UI render are
  distinct checks. Record each independently; do not imply cross-account success.
- If direct import does not activate MCP, document recipient-owned MCP registration
  plus Skill attachment as a separate setup route, and manual MCP + Skill as a
  fallback, explicitly not equivalent to full plugin installation.

## Verification and limits

Build/typecheck, validate manifests and deterministic ZIP contents, test all six
handlers against an isolated mock backend, and run read-only remote MCP checks.
Inspect the real React integration in an available host. No production write tests.
No guarantees of UI in terminal clients, mobile eligibility, or untested accounts.
Provide Russian installation guides, a short handoff README, and evidence/results.
