---
name: add-task
description: Use when the user wants to capture a TODO, action item, "remember to", or new piece of work for the Coresynq Platform or EPCR program. Always confirms project before creating. Available to both noobs (auto-routes to caller's project, forced Assignee=caller) and co-devs (full property control).
allowed-tools: mcp__coresynq-team__create_task, mcp__coresynq-team__create_coresynq_task
---

# Add Task

Captures a new task in the Coresynq Tasks DB via the coresynq-team MCP server. The exact tool varies by your role — but the user-facing flow is identical.

## When to invoke

- "add a task to ..."
- "remember to ..."
- "I need to ..."
- any unprompted TODO surfaced during a session ("we should fix that later")

## Flow

1. **Determine project.** If the user said "for ems-billing" / "for the main app" / "for coresynq" → `coresynq`. If they said "for EPCR" / "the new app" → `epcr`. **If unclear, ask once.** Don't guess.
2. **Announce routing.** Before creating, say: *"Adding to Coresynq – Coresynq Platform: <title>"* (or EPCR). User can redirect.
3. **Call the tool:**
   - If `mcp__coresynq-team__create_task` is available → noob role. Pass `project` (the enum) and `title`. Optionally pass `area` (LLM-inferred per the Coresynq Area table — see below), `priority` (P0/P1/P2/P3 if user signaled urgency), `due_date`, `notes`.
   - If `mcp__coresynq-team__create_coresynq_task` is available → co-dev role. Pass `title` and `initiative` (use `"Coresynq – Coresynq Platform"` for `coresynq`, `"Coresynq – EPCR"` for `epcr`). Optionally `assignee`, `area`, `priority`, `due_date`, `notes`.
4. **Confirm.** *"Created CTX-<n>: <title>"* with the URL.

## Area inference (Coresynq Platform tasks only)

Multi-select. One or two values. If nothing fits, leave blank — Collin triages.

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

For EPCR tasks, leave Area blank — the taxonomy isn't built yet.

## Edge cases

- If the user is on the **noob** policy and asks to "edit" or "change" an existing task: respond *"Editing tasks isn't enabled for you. Ask Collin to update it, or finish and recreate."*
- If `create_task` rejects with `BAD_INPUT` about project, the user used something that isn't `coresynq` or `epcr`. Clarify and retry.
- If `create_coresynq_task` rejects with the Coresynq Initiative list, the LLM picked an Initiative outside the set — re-route or ask.
