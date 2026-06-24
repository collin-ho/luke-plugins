---
name: luke-edit
description: ALWAYS invoke this skill for modifying tasks. Use when changing any task property (status, priority, due date, title, etc.). Uses Notion MCP tools directly against any of the per-business Tasks DBs (Cogent / Coresynq / Rezzy / Personal / Cortex Inbox).
allowed-tools: mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-fetch
---

# Edit Task Skill

Modify existing tasks across any of the 5 per-business Tasks DBs via Notion MCP. Tasks are referenced by page URL or ID — the skill is DB-agnostic.

## Personality

Quick updates, confirm what changed.
- **Brief confirmation** — "Updated the auth task: status is now In Progress"
- **Show what changed** — list the specific fields modified
- **Don't over-explain** — he knows what he wanted to change

## Anchors

DB-agnostic — edits whatever DB the found page lives in. Data-source IDs (for scoping a search when a domain is hinted) are in the Notion Brain — read `${CLAUDE_PLUGIN_ROOT}/README.md` §2.

## Execution

### Step 1: Find the task

If the user mentions a domain context (e.g., "the coresynq billing task"), scope the search to that DB:

```
mcp__claude_ai_Notion__notion-search({
  query: "<user's task description>",
  data_source_url: "<scope to one domain's Tasks data source if hinted>",
  filters: {},
  page_size: 5,
  max_highlight_length: 100
})
```

If domain isn't hinted, omit `data_source_url` to search across all the user's Notion content. Use the result's URL/parent to identify which DB the task lives in.

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

Updates work the same regardless of which Tasks DB the page lives in.

## Editable Properties

| Property | Type | Accepted Values |
|----------|------|-----------------|
| Title | title | Any text |
| Status | select | Backlog, To Do, In Progress, Pending Review, Blocked, Done, Archived. ⚠️ Cogent's done value is `_Done`, not `Done`. |
| Initiative | relation | Search for the initiative page first — scope to the matching domain's Initiatives DB |
| Due Date | date | Use `"date:Due Date:start": "YYYY-MM-DD"`, `"date:Due Date:is_datetime": 0` |
| Notes | rich_text | Any text |
| Source Spec | rich_text | Path or URL to a design spec |
| Assignee | person | Search for user with `query_type: "user"` first |
| Area | multi_select | Coresynq Tasks only — match existing options |
| Client | select | Rezzy Tasks only — match existing options |
| Legacy Task ID | rich_text | Read-only intent; rarely edited |
| userDefined:URL | url | Sometimes appears as "URL" — use `userDefined:URL` in property writes |

**Priority** exists but Collin doesn't use it — don't set it unless he explicitly asks.

**Do NOT** edit: `Domain` (does not exist), `Related Meeting` (does not exist on per-business Tasks DBs — meeting→task relations live on the cortex Meetings side; to link a task to a meeting, open the meeting page and set its Tasks-side relation).

To **clear** a property, set its value to `null`.

## Examples

**Change status:**
`properties: { "Status": "In Progress" }`

**Set due date:**
`properties: { "date:Due Date:start": "2026-04-25", "date:Due Date:is_datetime": 0 }`

**Clear due date:**
`properties: { "date:Due Date:start": null }`

**Update title:**
`properties: { "Title": "Revised task name here" }`

**Reassign Initiative** (must match a row in the target domain's Initiatives DB):
`properties: { "Initiative": "[\"https://www.notion.so/<new_initiative_page_id>\"]" }`

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion` (or `notion`), and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
