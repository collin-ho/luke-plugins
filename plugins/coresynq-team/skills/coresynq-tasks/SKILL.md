---
name: coresynq-tasks
description: List all open tasks in Coresynq Tasks DB (team-wide view). Read-only — no changelog writes.
allowed-tools: mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-get-users, mcp__plugin_luke-notion_luke-notion__dump-data-source
---

# Coresynq Tasks Skill (team-wide)

Shows the team's open tasks across `Coresynq Tasks`. Read-only. Use this for cross-assignee views; use `/coresynq-team:coresynq-my-tasks` for just-mine views.

## Data source

`collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3`

## Flow

1. **Parse user intent** — they may ask for:
   - "all open tasks" (default)
   - "all in <status>" (e.g. backlog, in progress, blocked)
   - "all assigned to <person>" — resolve the person via `notion-get-users` first
   - "all P0/P1 across the team"

2. **Query.** Default to the bundled dump server (likely >100 rows on a healthy backlog):

   ```
   mcp__plugin_luke-notion_luke-notion__dump-data-source({
     data_source_id: "fdb7593f-5d8f-4119-8006-da4ed3f5d0d3",
     filter: {
       "and": [
         {"property": "Status", "select": {"does_not_equal": "Done"}},
         {"property": "Status", "select": {"does_not_equal": "Archived"}}
       ]
     },
     output_path: "/tmp/coresynq-open-tasks.json"
   })
   ```

   Extend filter with status / priority / assignee per user intent. Use `output_path` to avoid flooding the conversation with raw rows.

3. **Aggregate via `Bash` + `jq`** on the dump file. Don't paste raw rows into the conversation.

4. **Present** in a compact table. Group by Status. Always include: Task ID, Priority, Title, Assignee, Due Date. Add Area for Coresynq Platform views.

   ```
   In Progress (8):
     CSQ-42  P1  Fix the SCT badge color           @matt   due 2026-05-12
     CSQ-39  P2  Review the eligibility flow       @alex
     ...

   To Do (24): ... (showing top 10 by P then due)

   Blocked (2): ...

   Backlog (53): ... (count only, ask if user wants list)
   ```

5. **Counts header** for cross-status views:

   ```
   Coresynq Tasks open: In Progress 8 · To Do 24 · Blocked 2 · Backlog 53 (total 87)
   ```

6. **Tone.** Plain reporting. Flag clusters: "Posting Initiative has 12 open" or "@matt has 9 in flight".

## Filter recipes

| Intent | Filter |
|---|---|
| All open | `{"and": [{"property":"Status","select":{"does_not_equal":"Done"}}, {"property":"Status","select":{"does_not_equal":"Archived"}}]}` |
| Blocked only | `{"property":"Status","select":{"equals":"Blocked"}}` |
| Assigned to X | `{"property":"Assignee","people":{"contains":"<user id>"}}` |
| P0/P1 only | `{"or":[{"property":"Priority","select":{"equals":"P0"}},{"property":"Priority","select":{"equals":"P1"}}]}` |
| By Area (Coresynq Platform) | `{"property":"Area","multi_select":{"contains":"Billing"}}` |
| By Initiative | first resolve the initiative URL via search on `collection://2da4502c-9651-4d39-b837-0f5996b32209`, then filter: `{"property":"Initiative","relation":{"contains":"<initiative page id>"}}` |

## Reauth handling

If any tool returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion`, and reconnect. Then retry."
2. Do NOT proceed — wait for user confirmation.
3. After they confirm, retry once.
