---
name: luke-add
description: ALWAYS invoke this skill for creating tasks - contains required routing and domain config. Use when user mentions something to do, wants to track something, or capture action items. NOT for pushing meeting review drafts — use /luke-meeting-commit for that path.
allowed-tools: Bash, Read, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-data-source
---

# Add Task Skill

All tasks go to a single canonical DB (cortex Tasks). Domain is determined by the Initiative relation — derivable from the Initiative name prefix (e.g., `Cogent – ClickUp` → Cogent).

## Data Source

| DB | Data Source ID |
|---|---|
| cortex Tasks | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` |

DB URL: `https://www.notion.so/4de35153f31d4427bc5a1c3b1c08648e`

Every `notion-create-pages` call uses this single data source. There are no domain-specific DBs.

## Personality

Quick and clean. He's capturing something, don't slow him down.
- **Announce routing** — "Adding to Cogent — ClickUp: Fix the auth bug"
- **Infer from context** — repo, conversation, explicit mention
- **Never silent** — always confirm where it landed

## Domain & Initiative Routing

### Repo → Domain Inference

| Repo path contains | Domain |
|---|---|
| `MFTtool-v2`, `MFR` | Cogent |
| `docebo-cogent-uni`, `CUv10demo` | Cogent |
| `teams-clickup-integration`, `hubspot` | Cogent |
| `EMS-billing`, `ems-billing` | Coresynq |
| `rezzy-analytics` | Rezzy |
| `luke-v2`, `luke-ios`, `luke-trmnl` | Personal |
| `notion-refactor`, `vault-mirror`, `obsidian-sync-agent` | Personal |

Use this table to **suggest** the right Initiative, not to pick a DB. All tasks go to the same DB regardless of domain.

### Routing Priority

1. **Explicit mention** — "add to coresynq" or "cogent task for clickup" → infer Initiative from that domain
2. **Repo context** — infer domain from cwd using table above, then match Initiative
3. **Conversation context** — if we've been talking about Rezzy, task probably belongs there
4. **Ambiguous / no Initiative** — leave Initiative empty. Task lands in intake (untriaged). Do NOT guess.

**Always announce:** "Adding to [Domain] — [Initiative]." User can redirect before creation.

## Canonical Properties (all tasks)

| Property | Default | Notes |
|---|---|---|
| Title | *(from user)* | Short, action-oriented |
| Status | To Do | Override only if user says blocked/backlog |
| Priority | P2 | Override if urgency is explicit or obvious |
| Initiative | *(inferred or asked)* | Relation to Initiatives DB. Empty = untriaged intake. |
| Assignee | *(empty)* | Set if user specifies a person |
| Due Date | *(empty)* | Set if user mentions a date |
| Notes | *(from context)* | 3-5 sentences max |
| Source Spec | *(empty)* | Set if task derives from a spec doc |

## Domain-Specific Properties

**Coresynq** — infer `Area` from task content:

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
| R2-Decision | R2 phase, decision pending, awaiting sign-off |
| R2-Deferred | R2 phase, deferred, not this round |

Multiple areas fine (1-2, not 5). If no fit, ask user.

**Rezzy** — set `Client` if a school is mentioned. Client options: Pitt, Wake Forest, Boston College, FSU, Brown, Duke, High Point, Clemson, UNC Chapel Hill. Also infer Initiative — internal uses "Rezzy – [Project]" naming, external client work uses "Rezzy External – [School]".

## Execution

1. Parse user intent → title, domain, initiative, priority, assignee, notes, due date
2. Announce: "Adding to [Domain] — [Initiative]" (or "Adding to intake — no Initiative" if untriaged)
3. Create via `mcp__claude_ai_Notion__notion-create-pages`:
   - parent: { type: "data_source_id", data_source_id: "b0d00fd8-eebb-434d-84c1-a652260fbe79" }
   - pages: [{ properties: { "Title": "task title", "Status": "To Do", "Priority": "P2", "Initiative": "[\"<initiative_page_url>\"]", "Notes": "context notes" } }]
   - Add `"Area": "[\"Billing\"]"` only for Coresynq-domain tasks
   - Add `"Client": "School Name"` only for Rezzy-domain tasks when a client is relevant
   - Omit Initiative entirely if no match — empty = untriaged intake
   - Do NOT set Task ID (auto-generated)
4. Confirm: "Created: [Title] (in [Domain] — [Initiative])" or "Created: [Title] (intake — untriaged)"

## Initiative Discovery

Resolve an Initiative name to a page URL via `mcp__claude_ai_Notion__notion-search` scoped to the Initiatives data source:

```
mcp__claude_ai_Notion__notion-search({
  query: "<initiative name or keyword>",
  data_source_url: "collection://28a0a1b7-d639-4e34-898f-e19415823dec",
  filters: {},
  page_size: 10,
  max_highlight_length: 0
})
```

Match by domain + name substring (initiative names follow `<Domain> – <Name>`, e.g., `Cogent – ClickUp`). Cache results in-session so you don't re-query for the same name.

Initiative page URLs use format: `https://www.notion.so/<page_id_with_dashes_removed>`.

If no matching initiative, suggest creating one via `/luke-domain`.

## Task ID prefix

The canonical Tasks DB auto-assigns Task IDs with a single `CTX-` prefix (e.g., `CTX-935`) regardless of domain. The old per-domain prefixes (COG-/RZ-/CSQ-) are gone post-consolidation. Task ID is auto-generated — do not set it.

## Adding New Area Options

If a task doesn't fit any existing Area, tell the user and offer to add one via `mcp__claude_ai_Notion__notion-update-data-source` on `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79`.
