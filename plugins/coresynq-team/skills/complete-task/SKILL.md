---
name: complete-task
description: Use when the user marks a Coresynq task as done — "I finished CTX-1234", "mark X done", "check off Y", "task complete".
allowed-tools: mcp__coresynq-team__complete_task, mcp__coresynq-team__complete_coresynq_task
---

# Complete Task

Marks a task as Done. Backed by:
- `mcp__coresynq-team__complete_task` (noob — verifies caller is in Assignee)
- `mcp__coresynq-team__complete_coresynq_task` (co-dev — verifies Coresynq domain)

## Flow

1. Resolve task_id. If the user used a title fragment instead of a CTX-id, ask which one — do NOT guess. CTX-ids are unambiguous.
2. Confirm the title before completing if there's any ambiguity: *"Mark CTX-1234 (Unmatched claims email-out) done?"*
3. Call the tool.
4. Confirm: *"Done: CTX-1234"*.

## Errors to handle gracefully

- `NOT_FOUND` → CTX-id doesn't exist. Tell the user; don't guess alternatives.
- `FORBIDDEN` (noob) → not assigned to them. Tell the user *"That task isn't assigned to you, so I can't close it. Ask Collin."*
- `FORBIDDEN` (co-dev) → not a Coresynq task. *"That's not a Coresynq task — outside this plugin's scope."*
