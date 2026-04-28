---
name: my-tasks
description: Use when the user asks "what's on my plate", "what am I working on", "show me my tasks", "what's blocked", or otherwise wants to see tasks assigned to them in coresynq or epcr.
allowed-tools: mcp__coresynq-team__list_my_tasks, mcp__coresynq-team__list_coresynq_tasks
---

# My Tasks

Lists tasks assigned to the caller. Backed by:
- `mcp__coresynq-team__list_my_tasks` (noob — auto-scopes to caller's Assignee)
- `mcp__coresynq-team__list_coresynq_tasks` with `assignee="me"` (co-dev — same effect)

## When to invoke

- "what's on my plate"
- "what am I working on"
- "show me my tasks"
- "anything overdue?"
- "what's blocked"

## Flow

1. Pick the available tool.
2. If the user specified a project (`coresynq` / `ems-billing` / `epcr`), pass `project`. Otherwise let it default to both.
3. If they specified a status filter ("blocked tasks", "what's in progress"), pass `status` array.
4. Default `limit` to 20 unless they ask for more.
5. **Render compactly** as a list, not a table:

   ```
   CTX-1162 (P1) — Unmatched claims email-out
   CTX-1161 (P1) — Patient/trip view enhancements
   CTX-1152 (P2) — Reschedule + host EPCR training
   ```

   Show url only if user asks for it.

6. If results are empty, say so plainly: *"Nothing assigned to you in coresynq or epcr right now."*
