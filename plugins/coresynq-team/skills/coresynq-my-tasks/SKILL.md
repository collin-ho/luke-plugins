---
name: coresynq-my-tasks
description: List tasks in Coresynq Tasks DB assigned to the current user. Read-only — no changelog writes.
allowed-tools: Bash, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-get-users
---

# Coresynq My Tasks Skill

Shows the current user's open tasks in `Coresynq Tasks`. Read-only.

## Data source

`collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3`

## Flow

1. **Identify the current user** — fetch via `mcp__claude_ai_Notion__notion-get-users({ user_id: "self" })`. Record their user ID + display name.
2. **Query the Coresynq Tasks DB.** For most users this returns <100 rows; hosted MCP is fine. For Collin (or anyone with a large open queue), use the bundled dump server.

   Hosted (typical):
   ```
   mcp__claude_ai_Notion__notion-search({
     query: "",
     data_source_url: "collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3",
     filters: {},
     page_size: 50,
     max_highlight_length: 0
   })
   ```
   Then filter in-memory: Assignee includes self, Status not in [Done, Archived].

   Exhaustive (when expected >100 rows) — via the `ntn` CLI:
   ```bash
   ntn datasources query fdb7593f-5d8f-4119-8006-da4ed3f5d0d3 \
     --filter '{"and":[{"property":"Assignee","people":{"contains":"<self user id>"}},{"property":"Status","select":{"does_not_equal":"Done"}},{"property":"Status","select":{"does_not_equal":"Archived"}}]}' \
     --limit 100 --json
   ```
   Page with `--start-cursor <next_cursor>` until exhausted.

3. **Group and present.** Group by Status; within each, sort by Priority (P0 → P3) then Due Date (oldest first). Render compactly:

   ```
   In Progress (3):
     CSQ-42  P1  Fix the SCT badge color           due 2026-05-12
     CSQ-39  P2  Review the eligibility flow
     CSQ-31  P2  Audit posting denials

   To Do (5):
     CSQ-50  P0  Eligibility breaks on multi-payer  due 2026-05-11
     ...

   Blocked (1):
     CSQ-28  —   Waiting on Caleb's review

   Backlog (12):
     ...
   ```

   Include Area or Client column if present. Flag overdue items.

4. **Tone.** Plain. *"Here's what's on your plate."* Mention if something's overdue or high priority.

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion`, and reconnect. Then retry."
2. Do NOT proceed — wait for the user to confirm.
3. After they confirm, retry once.
