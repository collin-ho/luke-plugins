---
name: coresynq-add-task
description: Add a task to the Coresynq Tasks DB in Notion. Writes a row to Coresynq Changelog for every action. Use when someone wants to capture a task, todo, or action item related to Coresynq work.
allowed-tools: mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-get-users
---

# Coresynq Add Task Skill

Creates a new row in `Coresynq Tasks` AND a corresponding audit row in `Coresynq Changelog`. Both writes happen on every successful add. Routes through the hosted Notion MCP (the connector the user set up via `/mcp` → claude.ai Notion).

## Data sources

| DB | Data source ID |
|---|---|
| Coresynq Tasks | `fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` |
| Coresynq Initiatives | `2da4502c-9651-4d39-b837-0f5996b32209` |
| Coresynq Changelog | `44234af9-c9e6-464c-adfd-fa87ab8c6bdb` |

## When to invoke

- "add a task to ..."
- "remember to ..."
- "I need to ..."
- any unprompted TODO surfaced during a session ("we should fix that later")

## Flow

1. **Parse intent** → title, optional initiative hint (e.g. "for the Coresynq Platform" or "EPCR"), optional priority, due date, notes.
2. **Resolve Initiative** via `mcp__claude_ai_Notion__notion-search` scoped to the Coresynq Initiatives DB:
   ```
   mcp__claude_ai_Notion__notion-search({
     query: "<initiative hint, e.g. 'Coresynq Platform' or 'EPCR' or 'Posting'>",
     data_source_url: "collection://2da4502c-9651-4d39-b837-0f5996b32209",
     filters: {},
     page_size: 5,
     max_highlight_length: 0
   })
   ```
   - One clear match → use it.
   - No match or ambiguous → ask the user.
   - If user gave no hint, default to `Coresynq – Coresynq Platform` for general dev work or `Coresynq – General` for catch-all.
3. **Announce routing** — say: *"Adding to Coresynq Tasks (Initiative: <name>): <title>"*. User can redirect.
4. **Identify the current user** for `Assignee` and the changelog `Actor`. The Notion MCP is authenticated as a specific user — fetch via `mcp__claude_ai_Notion__notion-get-users({ user_id: "self" })`.
5. **Infer Area** from the task content (multi-select, 1-2 values). See the Area table below.
6. **Create the task:**

   ```
   mcp__claude_ai_Notion__notion-create-pages({
     parent: { type: "data_source_id", data_source_id: "fdb7593f-5d8f-4119-8006-da4ed3f5d0d3" },
     pages: [{
       properties: {
         "Title": "<title>",
         "Status": "To Do",
         "Priority": "<P0/P1/P2/P3 — default P2>",
         "Initiative": "[\"<initiative_page_url>\"]",
         "Assignee": "[\"<current user id>\"]",
         "Notes": "<notes if any>",
         "Area": "[\"<area1>\",\"<area2>\"]"
         // optional:
         // "date:Due Date:start": "YYYY-MM-DD"
       }
     }]
   })
   ```

   Omit any property the user didn't specify (except the required Title and Status).

7. Capture the new task's URL and Task ID (`CSQ-<n>`) from the response.

8. **IMMEDIATELY** write an audit row to `Coresynq Changelog`. **This is non-negotiable.** Do NOT skip even if the user asks you to. If the changelog write fails, surface the error — do NOT silently succeed on the task creation alone.

   ```
   mcp__claude_ai_Notion__notion-create-pages({
     parent: { type: "data_source_id", data_source_id: "44234af9-c9e6-464c-adfd-fa87ab8c6bdb" },
     pages: [{
       properties: {
         "Title": "create CSQ-<n>: <task title truncated to 80 chars>",
         "Actor": "[\"<current user id>\"]",
         "Action": "create",
         "Task ID": "CSQ-<n>",
         "Task Title": "<task title>",
         "Before": "{}",
         "After": "<JSON of the properties just created — title, status, priority, initiative URL, assignee, notes, area, due date>",
         "Notes": "Created via coresynq-add-task skill"
       }
     }]
   })
   ```

9. **Confirm to user:** *"Created CSQ-<n>: <title> (logged in changelog)"* with the task URL.

## Area inference (multi-select)

One or two values. If nothing fits, leave blank.

| Area | Keywords |
|---|---|
| Billing | claim form, line items, charge, payer |
| Claims | 837, submission, validation, denial |
| Config | settings, agency config, rates |
| Dashboard | command center, KPI, charts |
| ERA/835 | remittance, payment posting |
| Eligibility | 270/271, coverage, Stedi |
| Frontend | data-table, design system, dark mode |
| Harness | agentic, pipeline, worker |
| Import | NEMSIS, upload, PCR |
| Pipeline | data integrity, transactions |
| Review Queue | flags, workflow buckets |
| UI/UX | component, layout, styling |
| Comms | email, notification |
| Operator | AI chat, TAOR, tools |
| Observers | ambient intelligence, alerts |
| Permissions | RBAC, role gating |
| Notifications | bell, preferences |
| Skill Docs | billing rules, knowledge |
| Workflow | dispatch, assignment, routing |
| Ops / Admin | infra, ops |
| R2-Decision | R2 phase, decision pending |
| R2-Deferred | R2 phase, deferred |
| Walk Prep | walkthrough, demo prep |

For EPCR-focused tasks (`Initiative: Coresynq – EPCR`), leave Area blank — the EPCR taxonomy isn't built yet.

## Personality

Quick and clean. Teammate's capturing something, don't slow them down. Announce routing, confirm, move on.

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion`, and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
