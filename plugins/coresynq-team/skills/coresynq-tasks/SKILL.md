---
name: coresynq-tasks
description: Use when the user wants to see Coresynq team work broadly — not just their own tasks. Triggers: "show me everything in coresynq", "what's blocked across the team", "P0 work this week", "all open Billing tasks". Co-dev only — silently no-ops for noob users (the underlying tool isn't exposed to them).
allowed-tools: mcp__coresynq-team__list_coresynq_tasks
---

# Coresynq Tasks (team-wide)

Broader query than `my-tasks`. Returns Coresynq-domain tasks across the team.

## When to invoke

- "show me everything in coresynq"
- "what's the team working on"
- "P0/P1 work this week"
- "all open Billing tasks"
- "what's blocked across coresynq"
- "what's Karen working on"

## Flow

1. Build filters from the user's words:
   - "P0/P1" → `priority: ["P0", "P1"]`
   - "blocked" → `status: ["Blocked"]`
   - "Billing tasks" / "Claims" / etc. → `area: [...]`
   - "what's <name> working on" → `assignee` set to that person's notion_user_id (look up via Notion if needed; if not findable, ask)
   - "due this week" → `due_before: <ISO date 7 days from today>`
2. Call `mcp__coresynq-team__list_coresynq_tasks`.
3. Render compactly. Group by Initiative if results span both Coresynq Platform and EPCR.

## Edge cases

- If the user is on the noob policy, this skill won't have a tool to call. Skill effectively no-ops; the LLM should fall back to `my-tasks` semantics or politely say *"That view isn't available to your account."*
- Results capped at 200. If you suspect more, say so explicitly.
