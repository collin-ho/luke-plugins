---
name: coresynq-complete-task
description: Mark a Coresynq task as Done. Writes a row to Coresynq Changelog. Use when a teammate finishes a task and wants to mark it complete.
allowed-tools: mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-get-users
---

# Coresynq Complete Task Skill

Marks a task in `Coresynq Tasks` as `Status: Done` AND writes an audit row to `Coresynq Changelog`.

## Data sources

| DB | Data source ID |
|---|---|
| Coresynq Tasks | `fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` |
| Coresynq Changelog | `44234af9-c9e6-464c-adfd-fa87ab8c6bdb` |

## Flow

1. **Parse intent** → which task. User may give a Task ID (`CSQ-42`), a URL, or a fuzzy title ("the badge color one").
2. **Locate the task:**
   - Task ID or URL → fetch directly via `mcp__claude_ai_Notion__notion-fetch`.
   - Fuzzy title → search:
     ```
     mcp__claude_ai_Notion__notion-search({
       query: "<title fragment>",
       data_source_url: "collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3",
       filters: {},
       page_size: 5,
       max_highlight_length: 100
     })
     ```
     - One clear match → proceed.
     - Multiple matches → present them, ask user to pick.
     - No matches → tell the user, ask to refine.
3. **Fetch current properties** (for the `Before` snapshot):
   ```
   mcp__claude_ai_Notion__notion-fetch({ id: "<task_page_id>" })
   ```
4. **Confirm with user** if Task ID was inferred from fuzzy match: *"Marking CSQ-<n> — '<title>' as Done?"*
5. **Update the page:**
   ```
   mcp__claude_ai_Notion__notion-update-page({
     page_id: "<task_page_id>",
     command: "update_properties",
     properties: { "Status": "Done" },
     content_updates: []
   })
   ```
6. **IMMEDIATELY** write a changelog row. **Non-negotiable** — do NOT skip:
   ```
   mcp__claude_ai_Notion__notion-create-pages({
     parent: { type: "data_source_id", data_source_id: "44234af9-c9e6-464c-adfd-fa87ab8c6bdb" },
     pages: [{
       properties: {
         "Title": "complete CSQ-<n>: <task title truncated to 80 chars>",
         "Actor": "[\"<current user id from notion-get-users self>\"]",
         "Action": "complete",
         "Task ID": "CSQ-<n>",
         "Task Title": "<task title>",
         "Before": "<JSON: {\"Status\": \"<previous status, e.g. To Do or In Progress>\"}>",
         "After": "<JSON: {\"Status\": \"Done\"}>",
         "Notes": "Marked Done via coresynq-complete-task skill"
       }
     }]
   })
   ```
   If the changelog write fails, surface the error — do NOT silently succeed.
7. **Confirm to user:** *"Done. CSQ-<n>: <title>. (logged in changelog)"*

## Multiple completions

If the user says "mark X, Y, Z all done" — loop steps 2-6 per task, then give a single confirmation: *"Done. Marked CSQ-12, CSQ-15, CSQ-19 (all logged in changelog)."*

## Personality

Quick confirmation, keep moving. No celebrations. *"Done. Knocked out 'Fix the badge color'."* Note if it was the last open task on something: *"That was the last open CSQ-Posting task."*

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion`, and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
