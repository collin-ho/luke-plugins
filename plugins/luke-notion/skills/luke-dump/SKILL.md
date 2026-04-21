---
name: luke-dump
description: Exhaustively enumerate a Notion data source beyond the hosted MCP's 100-row cap. Use when the user asks to dump, export, pull, get all, or audit; count everything in a status; or otherwise needs completeness guarantees over a Notion DB with >100 rows. Internally also called by luke-tasks for domain-wide enumeration queries.
allowed-tools: mcp__luke-notion__dump-data-source, Read, Bash
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

## Canonical data source IDs

| DB | Data source URI |
|---|---|
| Tasks | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` |
| Meetings | `collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c` |
| Initiatives | `collection://28a0a1b7-d639-4e34-898f-e19415823dec` |

## Invocation patterns

### Count-only

For "how many X in Y status" queries — paginate fully but return just the number.

```
mcp__luke-notion__dump-data-source({
  data_source_id: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
  filter: { "property": "Status", "select": { "equals": "Backlog" } },
  count_only: true
})
```

Response: `{"count": 237}`.

### Full dump to file

For large enumerations — write to a file to keep the tool response small, then read + process the file.

```
mcp__luke-notion__dump-data-source({
  data_source_id: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
  filter: { "property": "Status", "select": { "equals": "Backlog" } },
  output_path: "/tmp/luke-dump-backlog.json"
})
```

Response: `{"count": 237, "path": "/tmp/luke-dump-backlog.json"}`. Then `Read` the file or use `Bash` with `jq` to slice/aggregate.

### Inline (only for small result sets)

For enumerations expected to return <200 rows. Returns the full array in the tool response.

```
mcp__luke-notion__dump-data-source({
  data_source_id: "collection://28a0a1b7-d639-4e34-898f-e19415823dec"
})
```

Response: `{"count": N, "rows": [...]}`.

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
- **"integration lacks access to this data source"** — token is set but the integration isn't connected to the target DB. Tell the user to open the DB in Notion → `•••` → `Connections` → `Add luke-notion`.
- **"invalid data_source_id"** — the positional arg isn't a UUID or `collection://` URI. Multi-source database URLs are NOT supported in v0.2.0 — pass the data source UUID directly.

## Typical output (after a successful dump)

When reporting results to the user after an enumeration:

1. State the count. If `partial: true`, flag that the count is incomplete.
2. If relevant, summarize by whatever the user was asking about (domain split, status breakdown, etc.). Use `Bash` + `jq` on the `output_path` file rather than dumping raw rows into the conversation.
3. If the user asked for specifics (e.g. "what are the oldest"), follow up with a targeted slice from the dumped file.

Never flood the conversation with >50 raw rows. The whole point of `output_path` is to keep bulk data out of context.

## See also

- `/luke-tasks` — routes enumerate-style queries into this tool automatically.
- Notion data-source query reference: https://developers.notion.com/reference/query-a-data-source
