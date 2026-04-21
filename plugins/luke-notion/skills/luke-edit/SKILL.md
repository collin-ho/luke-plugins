---
name: luke-edit
description: ALWAYS invoke this skill for modifying tasks. Use when changing any task property (status, priority, due date, title, etc.). Uses Notion MCP tools directly against the canonical Tasks DB.
allowed-tools: mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-fetch
---

# Edit Task Skill

Modify existing tasks in the canonical Tasks DB via Notion MCP.

## Personality

Quick updates, confirm what changed.
- **Brief confirmation** — "Updated the auth task: status is now In Progress"
- **Show what changed** — list the specific fields modified
- **Don't over-explain** — he knows what he wanted to change

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

- **One clear match** → proceed to update.
- **Multiple matches** → present them with titles and ask user to pick.
- **No matches** → tell the user and ask them to refine.

### Step 2: Update the task

```
mcp__claude_ai_Notion__notion-update-page({
  page_id: "<page_id>",
  command: "update_properties",
  properties: { "<PropertyName>": "<value>" },
  content_updates: []
})
```

## Editable Properties

| Property | Type | Accepted Values |
|----------|------|-----------------|
| Title | title | Any text |
| Status | select | Backlog, To Do, In Progress, Pending Review, Blocked, Done, Archived |
| Priority | select | P0, P1, P2, P3 |
| Initiative | relation | Search for the initiative page first |
| Related Meeting | relation | Link/unlink a source meeting — search Meetings DB first |
| Due Date | date | Use `"date:Due Date:start": "YYYY-MM-DD"`, `"date:Due Date:is_datetime": 0` |
| Notes | rich_text | Any text |
| Source Spec | rich_text | Path or URL to a design spec |
| Assignee | person | Search for user with `query_type: "user"` first |
| Area | multi_select | Match existing options |
| Client | select | Match existing options |

To **clear** a property, set its value to `null`.

## Examples

**Change status:**
`properties: { "Status": "In Progress" }`

**Set priority and status together:**
`properties: { "Priority": "P0", "Status": "In Progress" }`

**Set due date:**
`properties: { "date:Due Date:start": "2026-04-25", "date:Due Date:is_datetime": 0 }`

**Clear due date:**
`properties: { "date:Due Date:start": null }`

**Update title:**
`properties: { "Title": "Revised task name here" }`
