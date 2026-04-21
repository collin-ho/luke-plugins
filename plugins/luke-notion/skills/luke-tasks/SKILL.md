---
name: luke-tasks
description: ALWAYS invoke this skill for viewing tasks. For targeted queries (overdue, untriaged, find-a-task, <~100 expected rows) use hosted MCP — this skill's default path. For exhaustive domain/status enumerations (ALL of X, EVERY Y, full counts) this skill delegates to /luke-dump via the bundled notion-dump MCP server.
allowed-tools: Bash, Read, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-query-database-view, mcp__claude_ai_Notion__notion-update-page, mcp__luke-notion__dump-data-source
---

# Tasks Skill

View, search, and update tasks in the canonical cortex Tasks DB via MCP.

## Canonical Tasks DB

All tasks live in a single consolidated database. Domain is derived from the Initiative name prefix client-side (see Key Properties below).

| Key | Value |
|---|---|
| DB URL | `https://www.notion.so/4de35153f31d4427bc5a1c3b1c08648e` |
| Data Source | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` |
| Default View | `view://64db81b1-253a-4738-a6fe-d7a60d58a235` |

### Key Properties

- **Initiative** — relation to Initiatives DB. Tasks without an Initiative are **intake/untriaged**.
- **Status** — Backlog, To Do, In Progress, Pending Review, Blocked, Done, Archived.
- **Priority** — P0, P1, P2, P3.
- **Area** — multi-select (Coresynq tasks only).
- **Client** — select (Rezzy tasks only).
- **Domain** — derived from the Initiative name prefix (e.g., `Cogent – ClickUp` → `Cogent`). The schema also has a `Domain` rollup property, but MCP responses return `<omitted />` for rollups, so we derive Domain from the Initiative name string instead. Note: the `<omitted />` behavior is hosted-MCP-only; `/luke-dump` (via the bundled REST MCP server) returns the full rollup value, so callers enumerating via `/luke-dump` can filter on `Domain[0]` directly.

## Routing

- "show my tasks" / "all tasks" → query the default view (one call)
- "coresynq tasks" / "cogent tasks" / "rezzy tasks" / "personal tasks" → use `notion-search` with the domain word as query
- "clickup tasks", "MFR tasks", etc. → `notion-search` with the initiative name as query
- "intake" / "untriaged" / "unassigned tasks" → fetch the default view and filter in-memory for tasks with no Initiative
- In a domain repo (e.g., EMS-billing) → default to that domain search, but ask if user says "all"

### Exhaustive queries (>100 rows likely)

For queries where completeness matters — the user said "ALL", "EVERY", or a count-of-everything — delegate to the bundled MCP server via `mcp__luke-notion__dump-data-source`. This paginates past the hosted MCP's 100-row cap.

**Examples:**
- "show me ALL Cogent tasks" → `dump-data-source` with a filter matching Cogent initiatives (see Filter Patterns below).
- "how many tasks total in Backlog" → `dump-data-source` with `count_only: true`.
- "export all Coresynq tasks" → `dump-data-source` with `output_path: "/tmp/coresynq-tasks.json"`.

**Filter patterns for common enumerations:**

| Intent | Filter JSON |
|---|---|
| All tasks in a Status | `{"property": "Status", "select": {"equals": "Backlog"}}` |
| All untriaged (no Initiative) | `{"property": "Initiative", "relation": {"is_empty": true}}` |
| All tasks touched since date | `{"property": "Last edited time", "last_edited_time": {"on_or_after": "2026-04-01"}}` |

Domain filtering (e.g. "all Cogent tasks") typically requires filtering on the `Initiative` relation — since hosted MCP returns `<omitted />` for the `Domain` rollup. Use `notion-search` to resolve Cogent initiative IDs first, then build a compound filter. For rough "all of domain X" queries when an exact initiative list isn't needed, fall back to a full dump + in-memory filter on Initiative name prefix. Alternatively, enumerate via `/luke-dump` (which calls the Notion REST API directly) to get the real `Domain` rollup values and filter on-site.

If a dump returns `partial: true` in the response, surface that to the user — the count is incomplete.

## Execution

### List all tasks

For "show all tasks", "everything on the board", or similar domain-wide enumerations — delegate to `/luke-dump` via the bundled MCP server. This paginates past the 100-row cap.

```
mcp__luke-notion__dump-data-source({
  data_source_id: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
  output_path: "/tmp/all-tasks.json"
})
```

Read the resulting JSON array with `Read` or use `Bash` + `jq` to slice. Never dump >50 raw rows into the conversation — aggregate first.

For count-only requests:

```
mcp__luke-notion__dump-data-source({
  data_source_id: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
  count_only: true
})
```

### Domain Filtering

Use `notion-search` scoped to the data source. Notion's fuzzy search matches against task title, notes, and linked-initiative name, so searching "cogent" surfaces tasks whose Initiative is `Cogent – *`:

```
mcp__claude_ai_Notion__notion-search({
  query: "<domain name or search terms>",
  data_source_url: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
  filters: {},
  page_size: 50,
  max_highlight_length: 0
})
```

**Do NOT try to filter by the Domain rollup via hosted MCP** — hosted MCP returns `<omitted />` for rollup values. If you need Domain filtering, enumerate via `/luke-dump` (which returns the real rollup value) and filter in-memory.

### Intake / Untriaged Tasks

Tasks where Initiative is empty are untriaged intake. Fetch the default view and filter for tasks with no Initiative set.

### Search tasks

Search by keyword:
```
mcp__claude_ai_Notion__notion-search({
  query: "<search terms>",
  data_source_url: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
  filters: {},
  page_size: 25,
  max_highlight_length: 0
})
```

### Update a task

Use `mcp__claude_ai_Notion__notion-update-page`:
```
mcp__claude_ai_Notion__notion-update-page({
  page_id: "<task_page_id>",
  command: "update_properties",
  properties: { "Status": "Done" },
  content_updates: []
})
```

## Output Format

Derive Domain from the Initiative name prefix (split on `" – "`, take the first half). Intake tasks (no Initiative) get Domain `Intake`.

```
| Task | Status | Priority | Domain | Initiative |
|------|--------|----------|--------|------------|
| Fix dashboard filter | To Do | P1 | Cogent | ClickUp |
| Add ERA parser | In Progress | P2 | Coresynq | Coresynq Platform |
| Update deck slides | Blocked | P1 | Rezzy | AI Engine |
| Buy groceries | To Do | — | Personal | General |
```

**Conditional columns by scope:**
- Coresynq-filtered output: add an `Area` column (multi-select from the task's Area property).
- Rezzy-filtered output: add a `Client` column (the task's Client select).
- Mixed/all-domain output: keep the 5-column base; don't dilute with mostly-empty Area/Client columns.

For domain counts at the top:
```
Cogent: 15 | Coresynq: 42 | Rezzy: 8 | Personal: 11 | Intake: 3 | Total: 79
```

**Show all tasks in the result set.** Don't silently truncate — if the response is huge (e.g., full default view overflow), fall back to showing counts plus the first N open tasks per domain and offer to scope down.

## Personality

You're Luke showing him his tasks.
- **Call out the obvious** — If something's overdue or high priority, mention it
- **Note patterns** — "Coresynq's piling up" or "Personal's pretty clear"
- **Flag intake** — If there are untriaged tasks, mention them: "3 tasks sitting in intake with no Initiative"
- **Show first, comment second** — Display the tasks, then add observations

## Editing/Completing Tasks

Use `/luke-edit` skill for modifying tasks (content, due dates).
Use `/luke-done` skill for completing tasks.
