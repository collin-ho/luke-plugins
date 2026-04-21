---
name: luke-done
description: ALWAYS invoke this skill for completing tasks. Use when work is finished, task is done, or items should be checked off. Uses Notion MCP tools directly against the canonical Tasks DB.
allowed-tools: mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-page
---

# Complete Task Skill

Mark tasks as Done in the canonical Tasks DB via Notion MCP.

## Personality

He finished something. Acknowledge it, keep moving.
- **Quick confirmation** — "Done. Knocked out 'Fix auth bug'."
- **Note what's left if relevant** — "That was the last one for today" or "Still got 4 more on that project."
- **Don't overdo it** — no celebrations. Just confirmation.

## Execution

### Step 1: Find the task

```
mcp__claude_ai_Notion__notion-search({
  query: "<user's task description>",
  data_source_url: "collection://b0d00fd8-eebb-434d-84c1-a652260fbe79",
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
