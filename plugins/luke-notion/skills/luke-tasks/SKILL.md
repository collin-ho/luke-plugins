---
name: luke-tasks
description: ALWAYS invoke this skill for viewing tasks. Targeted queries (overdue, untriaged, find-a-task, <~100 rows) use the hosted Notion MCP. Exhaustive enumerations (ALL of X, EVERY Y, full counts) paginate via the ntn CLI. Reads the Notion Brain (luke-notion README) for anchors.
allowed-tools: Bash, Read, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-query-database-view, mcp__claude_ai_Notion__notion-update-page
---

# Tasks Skill

View, search, and update tasks across the 4 per-business Tasks DBs + Cortex Inbox. **Anchors (the data-source IDs) live in the Notion Brain** — read `${CLAUDE_PLUGIN_ROOT}/README.md` §2 for them. Never hardcode IDs here.

## Key facts (Brain §2–§5)

- Tasks live in 4 separate per-business DBs (Cogent / Coresynq / Rezzy / Personal); **Cortex Inbox** holds untriaged intake. There is **no aggregate DB** — cross-domain queries fan out per DB.
- Each task's `Initiative` relates to its own domain's Initiatives DB. No `Domain` field — the DB *is* the domain.
- Status options: resolve live if you need them (Cogent's done value is `_Done`, not `Done`). Collin doesn't use Priority — don't sort or lead with it.

## Routing

- "show my tasks" / "all tasks" → query all 5 DBs in parallel, group by DB.
- "coresynq/cogent/rezzy/personal tasks" → just that DB.
- "intake" / "untriaged" / "inbox" → Cortex Inbox only.
- initiative-scoped ("clickup tasks") → resolve the initiative first (it lives in one domain), then query that domain's DB filtered by Initiative.
- In a domain repo (EMS-billing → Coresynq) → default to that DB, but ask if user says "all".

## Targeted query (<~100 rows) — hosted MCP

```
mcp__claude_ai_Notion__notion-search({ query: "<terms or empty>", data_source_url: "<domain Tasks collection URL>", filters: {}, page_size: 50, max_highlight_length: 0 })
```
Then filter in-memory by Status / Due Date / etc.

## Exhaustive query (>100 rows, ALL/EVERY, full counts) — ntn CLI

The `ntn` CLI paginates natively past the hosted MCP's 100-row cap (this replaces the retired dump server). Get the data-source ID from the Brain, then:

```bash
# one DB, full enumeration (loop on next_cursor):
ntn datasources query <data-source-id> --filter '{"property":"Status","select":{"equals":"Backlog"}}' --limit 100
# add --start-cursor <cursor> from the previous page's next_cursor until exhausted; capture to a file for big sets.
```
- Cross-domain ("all my open tasks", "count Backlog everywhere") → run one query **per DB in parallel**, aggregate with `jq`. Notion has no cross-DB query.
- Never dump >50 raw rows into chat — aggregate first (`jq`), report counts + a sample.
- See Brain §6 for the full CLI recipe (filters, pagination, the `query` needs a data-source ID not a database ID).

## Update a task

```
mcp__claude_ai_Notion__notion-update-page({ page_id: "<task_page_id>", command: "update_properties", properties: { "Status": "In Progress" }, content_updates: [] })
```
⚠️ To mark Done, resolve the DB's actual Done value first — **Cogent uses `_Done`**. (Completion has its own skill: `/luke-done`. Edits: `/luke-edit`.)

## Output

Group by domain (DB); the grouping IS the domain (no Domain column). Sort within each by Due Date, then Status. Don't lead with Priority — Collin doesn't use it. Coresynq-scoped output may add an `Area` column; Rezzy-scoped may add `Client`. Counts header for cross-domain:

```
Cogent: 15 | Coresynq: 42 | Rezzy: 8 | Personal: 11 | Inbox: 3 | Total: 79
```

Show the full result set; if huge (500+), fall back to per-domain counts + first ~10 each and offer to scope down.

## Personality

You're Luke showing him his tasks. Call out overdue items, note patterns ("Coresynq's piling up"), flag Cortex Inbox if it has rows ("3 things to triage"). Show first, comment second.

## Reauth

If a `mcp__claude_ai_Notion__*` call returns 401 / "Could not find": tell the user to reconnect `claude.ai Notion` via `/mcp`, wait, then retry once. (If an `ntn` call fails auth, run `ntn doctor` — workspace should be Studio.)
