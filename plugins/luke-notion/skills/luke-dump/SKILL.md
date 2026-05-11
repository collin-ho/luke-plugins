---
name: luke-dump
description: Exhaustively enumerate a Notion data source beyond the hosted MCP's 100-row cap. Use when the user asks to dump, export, pull, get all, or audit; count everything in a status; or otherwise needs completeness guarantees over a Notion DB with >100 rows. Internally also called by luke-tasks for domain-wide enumeration queries.
allowed-tools: mcp__plugin_luke-notion_luke-notion__dump-data-source, Read, Bash
---

# Luke Dump Skill

Exhaustive pagination of Notion data sources via the bundled `luke-notion` MCP server. Uses the Notion REST API directly with cursor-based pagination — no 100-row cap.

## When to use

- User asks for a complete enumeration ("ALL of X", "EVERY Y").
- User asks for a count where completeness matters ("how many tasks total in Backlog").
- User asks for an export or full-board audit.
- Another skill (typically `luke-tasks`) needs to enumerate a domain.

## When NOT to use

- Targeted single-task lookup → use hosted `notion-fetch`.
- Keyword discovery → use hosted `notion-search`.
- Known-small result sets (<100 rows) → hosted `notion-query-database-view` is fine.

## Canonical data source IDs (post-refactor)

### Tasks DBs (5)

| Domain | Data source URI |
|---|---|
| Cogent | `collection://e71b583f-242f-4b16-9dfa-d9a8d82949b8` |
| Coresynq | `collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` |
| Rezzy | `collection://dde1524b-f5da-44a4-8c89-3479f180cc9d` |
| Personal | `collection://a405e3f1-7196-4e23-afa4-c64f54c08ff7` |
| Cortex Inbox | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` |

### Initiatives DBs (4)

| Domain | Data source URI |
|---|---|
| Cogent | `collection://9afa9c00-6eda-49c9-b022-f77656adff97` |
| Coresynq | `collection://2da4502c-9651-4d39-b837-0f5996b32209` |
| Rezzy | `collection://ef52d445-66b4-4619-bdf1-903ac0f977f0` |
| Personal | `collection://5189917d-6eb0-4802-88ee-faa36378b085` |

### Other

| DB | Data source URI |
|---|---|
| Meetings (cortex, collin-only) | `collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c` |
| Coresynq Changelog | `collection://44234af9-c9e6-464c-adfd-fa87ab8c6bdb` |
| Cortex Initiatives (frozen, pre-refactor) | `collection://28a0a1b7-d639-4e34-898f-e19415823dec` |

## Invocation patterns

### Count-only

For "how many X in Y status" queries — paginate fully but return just the number.

```
mcp__plugin_luke-notion_luke-notion__dump-data-source({
  data_source_id: "collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3",
  filter: { "property": "Status", "select": { "equals": "Backlog" } },
  count_only: true
})
```

Response: `{"count": 237}`.

### Full dump to file

For large enumerations — write to a file to keep the tool response small, then read + process the file.

```
mcp__plugin_luke-notion_luke-notion__dump-data-source({
  data_source_id: "collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3",
  filter: { "property": "Status", "select": { "equals": "Backlog" } },
  output_path: "/tmp/luke-dump-coresynq-backlog.json"
})
```

Response: `{"count": 237, "path": "/tmp/luke-dump-coresynq-backlog.json"}`. Then `Read` the file or use `Bash` with `jq` to slice/aggregate.

### Inline (only for small result sets)

For enumerations expected to return <200 rows. Returns the full array in the tool response.

```
mcp__plugin_luke-notion_luke-notion__dump-data-source({
  data_source_id: "collection://9afa9c00-6eda-49c9-b022-f77656adff97"
})
```

Response: `[{...row1}, {...row2}, ...]` (flat array of rows with properties at top level).

## Partial returns

If pagination hits a persistent 429 or 5xx mid-dump (after one retry), the server returns `partial: true` in the response with whatever rows it successfully fetched. ALWAYS check for `partial` before reporting counts as authoritative.

```
{"count": 412, "partial": true, "path": "/tmp/x.json"}  // got 412 of an unknown total
```

In that case, surface the partial state to the user:

> "Got 412 rows before hitting a rate limit. Count is incomplete — re-run to get the rest."

## Filter shape

The filter JSON is passed through verbatim to `POST /v1/data_sources/{id}/query`. Follow the Notion `data_sources` endpoint schema (may differ slightly from the legacy `databases` endpoint — consult https://developers.notion.com/reference/query-a-data-source when composing non-trivial filters).

Common filter patterns:

- Status equals: `{"property": "Status", "select": {"equals": "Backlog"}}`
- Initiative relation is-empty: `{"property": "Initiative", "relation": {"is_empty": true}}`
- Compound AND: `{"and": [filterA, filterB]}`
- Compound OR: `{"or": [filterA, filterB]}`

## Errors and what they mean

- **"NOTION_TOKEN is not set"** — the user hasn't provided the token. Direct them to run `/plugin install luke-notion@luke-plugins` to re-prompt, or `export NOTION_TOKEN=ntn_...` in shell.
- **"integration lacks access to this data source" / 404 with "Make sure the relevant pages and databases are shared with your integration"** — token is set but the Mac-mini (luke-notion) integration isn't connected to the target DB. Open the DB in Notion → `•••` → `Connections` → add the integration. The integration name shown in the error is the canonical name (e.g., "Mac-mini").
- **"invalid data_source_id"** — the positional arg isn't a UUID or `collection://` URI. Multi-source database URLs are NOT supported in v0.2.0 — pass the data source UUID directly.

## Typical output (after a successful dump)

When reporting results to the user after an enumeration:

1. State the count. If `partial: true`, flag that the count is incomplete.
2. If relevant, summarize by whatever the user was asking about (status breakdown, etc.). Use `Bash` + `jq` on the `output_path` file rather than dumping raw rows into the conversation.
3. If the user asked for specifics (e.g. "what are the oldest"), follow up with a targeted slice from the dumped file.

Never flood the conversation with >50 raw rows. The whole point of `output_path` is to keep bulk data out of context.

## Cross-domain enumerations

When the user asks for an aggregate across all 5 Tasks DBs, run 5 parallel dumps (one per DB) — Notion doesn't support cross-DB queries.

## See also

- `/luke-tasks` — routes enumerate-style queries into this tool automatically.
- Notion data-source query reference: https://developers.notion.com/reference/query-a-data-source

## Reauth handling

If a dump returns a 401-style auth error or the integration error above:

1. Tell the user: "Your luke-notion integration (Mac-mini) has lost access to that DB. Open the DB in Notion → `•••` → `Connections` → add `Mac-mini`. Then retry."
2. If the error is on a hosted Notion MCP tool elsewhere in the chain, fall back to the standard reauth flow: `/mcp` → reconnect `claude.ai Notion`.
