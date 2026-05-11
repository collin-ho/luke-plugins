---
name: luke-done
description: ALWAYS invoke this skill for completing tasks. Use when work is finished, task is done, or items should be checked off. Uses Notion MCP tools directly against any of the per-business Tasks DBs (Cogent / Coresynq / Rezzy / Personal / Cortex Inbox).
allowed-tools: mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-page
---

# Complete Task Skill

Mark tasks as Done across any of the 5 per-business Tasks DBs via Notion MCP. The skill is DB-agnostic — it finds the task by name/URL and updates whichever DB it lives in.

## Personality

He finished something. Acknowledge it, keep moving.
- **Quick confirmation** — "Done. Knocked out 'Fix auth bug'."
- **Note what's left if relevant** — "That was the last one for today" or "Still got 4 more on that project."
- **Don't overdo it** — no celebrations. Just confirmation.

## Per-business Tasks DB data sources

| Domain | Data source |
|---|---|
| Cogent | `collection://e71b583f-242f-4b16-9dfa-d9a8d82949b8` |
| Coresynq | `collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` |
| Rezzy | `collection://dde1524b-f5da-44a4-8c89-3479f180cc9d` |
| Personal | `collection://a405e3f1-7196-4e23-afa4-c64f54c08ff7` |
| Cortex Inbox | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` |

## Execution

### Step 1: Find the task

If the user mentions a domain (e.g., "mark the coresynq billing task done"), scope to that DB. Otherwise, omit `data_source_url` for a workspace-wide search:

```
mcp__claude_ai_Notion__notion-search({
  query: "<user's task description>",
  data_source_url: "<scope to one domain's Tasks data source if hinted>",
  filters: {},
  page_size: 5,
  max_highlight_length: 100
})
```

- **One clear match** → proceed to mark done.
- **Multiple matches** → present them and ask user to pick.
- **No matches** → tell the user, ask to refine.

### Step 2: Mark done

```
mcp__claude_ai_Notion__notion-update-page({
  page_id: "<page_id>",
  command: "update_properties",
  properties: { "Status": "Done" },
  content_updates: []
})
```

### Step 3: Confirm

Respond with the task title. Example: "Done. Knocked out 'Fix auth bug'."

For multiple tasks, loop Steps 1-2 for each and confirm all at once.

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion` (or `notion`), and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
