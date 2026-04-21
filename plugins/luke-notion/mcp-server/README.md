# mcp-server/

Stdio MCP server bundled with the `luke-notion` plugin. One tool: `dump-data-source` — exhaustive pagination of Notion data sources beyond the hosted MCP's 100-row cap.

## Files

- `notion-dump.mjs` — server entry point + exported pure helpers (flattenProp, normalizeDataSourceId, paginateDataSource).
- `test.mjs` — `node --test` unit tests for the pure helpers. Run with `node --test test.mjs`.

## Debug

If the server misbehaves in a Claude Code session, check the plugin's stderr in `~/Library/Logs/Claude/` (macOS) or run the server manually from a terminal:

```bash
NOTION_TOKEN=ntn_... node ~/workspace/luke-plugins/plugins/luke-notion/mcp-server/notion-dump.mjs < /dev/null
```

and paste an MCP `initialize` JSON-RPC message to stdin, read stdout.

## Dependencies

Zero. Node 18+ only. No npm install, no node_modules, no package.json.
