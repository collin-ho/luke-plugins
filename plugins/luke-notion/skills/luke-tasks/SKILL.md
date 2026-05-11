---
name: luke-tasks
description: ALWAYS invoke this skill for viewing tasks. For targeted queries (overdue, untriaged, find-a-task, <~100 expected rows) use hosted MCP — this skill's default path. For exhaustive domain/status enumerations (ALL of X, EVERY Y, full counts) this skill delegates to /luke-dump via the bundled notion-dump MCP server.
allowed-tools: Bash, Read, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-query-database-view, mcp__claude_ai_Notion__notion-update-page, mcp__plugin_luke-notion_luke-notion__dump-data-source
---

# Tasks Skill

View, search, and update tasks across the 5 per-business Tasks DBs (Cogent, Coresynq, Rezzy, Personal, Cortex Inbox).

## Data Sources

| Domain | Tasks DB data source |
|---|---|
| Cogent | `collection://e71b583f-242f-4b16-9dfa-d9a8d82949b8` |
| Coresynq | `collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` |
| Rezzy | `collection://dde1524b-f5da-44a4-8c89-3479f180cc9d` |
| Personal | `collection://a405e3f1-7196-4e23-afa4-c64f54c08ff7` |
| Cortex Inbox (untriaged) | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` |

### Key Properties

- **Initiative** — relation to that DB's own Initiatives DB. Cortex Inbox tasks have no Initiative (intake state).
- **Status** — Backlog, To Do, In Progress, Pending Review, Blocked, Done, Archived.
- **Priority** — P0, P1, P2, P3.
- **Area** — multi-select (Coresynq Tasks only).
- **Client** — select (Rezzy Tasks only).
- **Legacy Task ID** — text. Preserves the pre-refactor cortex Task ID (`CTX###`) for tasks migrated from cortex. New tasks get fresh per-DB IDs (CGT-, CSQ-, RZY-, PER-).

**There is no `Domain` field anymore.** Teamspace IS the domain — the DB you're in IS the domain.

## Routing

- "show my tasks" / "all tasks" → query all 5 DBs in parallel, group results by DB in output
- "coresynq tasks" / "cogent tasks" / "rezzy tasks" / "personal tasks" → query just that DB
- "intake" / "untriaged" / "inbox" → query Cortex Inbox only
- "clickup tasks", "MFR tasks", etc. (initiative-scoped) → resolve the initiative first (each is in a specific domain), then query that domain's Tasks DB filtered by Initiative
- In a domain repo (e.g., EMS-billing → Coresynq) → default to that domain's DB, but ask if user says "all"

### Single-DB targeted query

For "Coresynq backlog" or "Rezzy in-progress tasks":

```
mcp__claude_ai_Notion__notion-search({
  query: "",
  data_source_url: "<that domain's Tasks data source URL>",
  filters: {},
  page_size: 25,
  max_highlight_length: 0
})
```

Then filter results in-memory by Status / Priority / etc.

### Multi-DB query (no domain specified)

For "show all my open tasks" — issue parallel queries to all 5 Tasks DBs. Don't try to merge them into a single query; Notion doesn't support cross-DB filters. After all responses, group by DB in the output.

### Exhaustive queries (>100 rows likely)

For queries where completeness matters — the user said "ALL", "EVERY", or a count-of-everything — delegate to `mcp__plugin_luke-notion_luke-notion__dump-data-source` per DB. This paginates past the hosted MCP's 100-row cap.

**Examples:**

- "show me ALL Coresynq tasks" — dump Coresynq Tasks data source.
- "how many tasks across all domains in Backlog" — dump each Tasks DB with `count_only: true` + Status filter, sum.
- "export all tasks" — dump each DB to `/tmp/<domain>-tasks.json`.

**Filter patterns for common enumerations:**

| Intent | Filter JSON |
|---|---|
| All tasks in a Status | `{"property": "Status", "select": {"equals": "Backlog"}}` |
| All untriaged (cortex inbox) | (query Cortex Inbox data source — all rows are untriaged by definition) |
| All tasks touched since date | `{"property": "Last edited time", "last_edited_time": {"on_or_after": "2026-04-01"}}` |
| All P0/P1 across domains | `{"or": [{"property": "Priority", "select": {"equals": "P0"}}, {"property": "Priority", "select": {"equals": "P1"}}]}` |

If a dump returns `partial: true` in the response, surface that to the user — the count is incomplete.

## Execution

### List all tasks (cross-domain)

For "show all tasks" or "everything on the board" — parallel dump all 5 DBs:

```
# In parallel:
mcp__plugin_luke-notion_luke-notion__dump-data-source({ data_source_id: "e71b583f-242f-4b16-9dfa-d9a8d82949b8", output_path: "/tmp/tasks-cogent.json" })
mcp__plugin_luke-notion_luke-notion__dump-data-source({ data_source_id: "fdb7593f-5d8f-4119-8006-da4ed3f5d0d3", output_path: "/tmp/tasks-coresynq.json" })
mcp__plugin_luke-notion_luke-notion__dump-data-source({ data_source_id: "dde1524b-f5da-44a4-8c89-3479f180cc9d", output_path: "/tmp/tasks-rezzy.json" })
mcp__plugin_luke-notion_luke-notion__dump-data-source({ data_source_id: "a405e3f1-7196-4e23-afa4-c64f54c08ff7", output_path: "/tmp/tasks-personal.json" })
mcp__plugin_luke-notion_luke-notion__dump-data-source({ data_source_id: "b0d00fd8-eebb-434d-84c1-a652260fbe79", output_path: "/tmp/tasks-inbox.json" })
```

Then aggregate via `Bash` + `jq`. Never dump >50 raw rows into the conversation — aggregate first.

### Count-only (per domain or total)

```
mcp__plugin_luke-notion_luke-notion__dump-data-source({
  data_source_id: "<domain's data source>",
  filter: { "property": "Status", "select": { "equals": "In Progress" } },
  count_only: true
})
```

Run per DB, sum results.

### Single-domain queries

`notion-search` scoped to one Tasks data source:

```
mcp__claude_ai_Notion__notion-search({
  query: "<search terms or empty>",
  data_source_url: "<domain's Tasks collection URL>",
  filters: {},
  page_size: 50,
  max_highlight_length: 0
})
```

### Intake / Untriaged Tasks

Cortex Inbox IS the untriaged bucket. Query it directly:

```
mcp__plugin_luke-notion_luke-notion__dump-data-source({
  data_source_id: "b0d00fd8-eebb-434d-84c1-a652260fbe79"
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

The page lives in whichever per-business DB the URL points at — `notion-update-page` doesn't care about DB membership.

## Output Format

Group results by Domain (DB), sort within each by Priority ascending then Due Date ascending. Don't try to render a `Domain` column — the grouping IS the domain.

```
Cogent Tasks (15 open)
  CGT-42  P1  Fix the auth bug                    due 2026-05-12
  CGT-39  P2  Review the ClickUp portfolio
  …

Coresynq Tasks (42 open)
  CSQ-127  P0  Eligibility breaks on multi-payer  due 2026-05-11
  CSQ-118  P1  Posting walk prep                  due 2026-05-15
  …

Rezzy Tasks (8 open)
  RZY-12   P2  Deck cleanup for Pitt
  …

Personal Tasks (11 open)
  PER-3    P3  Cancel railway
  …

Cortex Inbox (3 untriaged)
  CTX-940  —   Some unrouted thing
  …
```

**Conditional columns by scope:**
- Coresynq-filtered output: add an `Area` column (multi-select).
- Rezzy-filtered output: add a `Client` column.
- Cross-domain output: don't dilute the table with mostly-empty Area/Client columns.

**Counts header** for cross-domain queries:

```
Cogent: 15 | Coresynq: 42 | Rezzy: 8 | Personal: 11 | Inbox: 3 | Total: 79
```

**Show all tasks in the result set.** Don't silently truncate — if the response is huge (e.g., 500+ open tasks), fall back to per-domain counts plus the first 10 P0/P1 per domain and offer to scope down.

## Personality

You're Luke showing him his tasks.
- **Call out the obvious** — If something's overdue or P0, mention it
- **Note patterns** — "Coresynq's piling up" or "Personal's pretty clear"
- **Flag inbox** — If Cortex Inbox has rows, mention them: "3 things sitting in inbox to triage"
- **Show first, comment second** — Display the tasks, then add observations

## Editing/Completing Tasks

Use `/luke-edit` skill for modifying tasks (content, due dates).
Use `/luke-done` skill for completing tasks.

## Reauth handling

If any `mcp__claude_ai_Notion__*` or `mcp__plugin_luke-notion_luke-notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion` (or `notion`), and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
