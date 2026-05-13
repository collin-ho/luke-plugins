---
name: luke-add
description: ALWAYS invoke this skill for creating tasks - contains required routing and domain config. Use when user mentions something to do, wants to track something, or capture action items. NOT for pushing meeting review drafts — use /luke-meeting-commit for that path.
allowed-tools: Bash, Read, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-data-source
---

# Add Task Skill

Each business has its own Tasks DB in its own teamspace. Domain → DB is a hard routing decision; the resolved Domain picks both the target Tasks DB and the Initiatives DB the task's Initiative relation must point at. Untriaged tasks (no clear domain) land in the Cortex Inbox.

## Data Sources

| Domain | Tasks DB data source | Initiatives DB data source | Task ID prefix |
|---|---|---|---|
| Cogent | `collection://e71b583f-242f-4b16-9dfa-d9a8d82949b8` | `collection://9afa9c00-6eda-49c9-b022-f77656adff97` | `CGT-` |
| Coresynq | `collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` | `collection://2da4502c-9651-4d39-b837-0f5996b32209` | `CSQ-` |
| Rezzy | `collection://dde1524b-f5da-44a4-8c89-3479f180cc9d` | `collection://ef52d445-66b4-4619-bdf1-903ac0f977f0` | `RZY-` |
| Personal | `collection://a405e3f1-7196-4e23-afa4-c64f54c08ff7` | `collection://5189917d-6eb0-4802-88ee-faa36378b085` | `PER-` |
| Cortex Inbox (untriaged) | `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79` | n/a | `CTX-` |

Initiative search is **scoped to the resolved Domain's Initiatives DB only** — never query a cross-domain Initiatives DB.

## Personality

Quick and clean. He's capturing something, don't slow him down.
- **Announce routing** — "Adding to Cogent Tasks — Cogent – ClickUp: Fix the auth bug"
- **Infer from context** — repo, conversation, explicit mention
- **Never silent** — always confirm where it landed

## Domain Routing

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

### Routing Priority

1. **Explicit mention** — "add to coresynq" or "cogent task for clickup" → resolve to that domain's DBs
2. **Repo context** — infer domain from cwd using table above, then match Initiative within that domain's Initiatives DB
3. **Conversation context** — if we've been talking about Rezzy, task probably belongs there
4. **Ambiguous / no clear domain** — task lands in **Cortex Inbox** (untriaged). Do NOT guess.

**Always announce:** "Adding to [Tasks DB] — [Initiative]" (or "Adding to Cortex Inbox — untriaged" if no domain). User can redirect before creation.

## Canonical Properties (all tasks)

| Property | Default | Notes |
|---|---|---|
| Title | *(from user)* | Short, action-oriented |
| Status | To Do | Override only if user says blocked/backlog |
| Priority | P2 | Override if urgency is explicit or obvious |
| Initiative | *(inferred or asked)* | Relation to the resolved domain's Initiatives DB. Empty only for Cortex Inbox tasks. |
| Assignee | *(empty)* | Set if user specifies a person |
| Due Date | *(empty)* | Set if user mentions a date — use `date:Due Date:start` |
| Notes | *(from context)* | 3-5 sentences max |
| Source Spec | *(empty)* | Set if task derives from a spec doc |

**Do NOT** set: `Domain` field (does not exist post-refactor — teamspace IS the domain), `Related Meeting` field (relation is now meeting-side only — cortex Meetings DB has the Tasks relations).

## Domain-Specific Properties

**Coresynq** — infer `Area` from task content (multi-select):

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
| R2-Decision | R2 phase, decision pending, awaiting sign-off |
| R2-Deferred | R2 phase, deferred, not this round |
| Walk Prep | walkthrough, demo prep |

Multiple areas fine (1-2, not 5). If no fit, ask user.

**Rezzy** — set `Client` if a school is mentioned. Client options: Pitt, Wake Forest, Boston College, FSU, Brown, Duke, High Point, Clemson, UNC Chapel Hill. Also infer Initiative — internal uses "Rezzy – [Project]" naming, external client work uses "Rezzy External – [School]".

**Cogent / Personal** — no domain-specific fields beyond the canonical set. Don't include `Area` or `Client`.

## Execution

1. Parse user intent → title, domain, initiative, priority, assignee, notes, due date
2. Announce: "Adding to [Tasks DB] — [Initiative]" (or "Adding to Cortex Inbox — untriaged")
3. Create via `mcp__claude_ai_Notion__notion-create-pages`:
   - `parent`: `{ type: "data_source_id", data_source_id: "<resolved domain's Tasks data source UUID, no collection:// prefix>" }`
   - `pages`: `[{ properties: { "Title": "...", "Status": "To Do", "Priority": "P2", "Initiative": "[\"<initiative_page_url>\"]", "Notes": "..." } }]`
   - For Coresynq: include `"Area": "[\"Billing\"]"` if a fit exists
   - For Rezzy: include `"Client": "School Name"` if relevant
   - For Cogent / Personal: no Area, no Client
   - For Cortex Inbox: omit Initiative entirely (intake state)
   - Do NOT set Task ID (auto-generated, per-DB prefix)
4. Confirm: "Created: [Title] (in [Tasks DB] — [Initiative])" or "Created: [Title] (Cortex Inbox — untriaged)"

## Initiative Discovery

Resolve an Initiative name to a page URL via `mcp__claude_ai_Notion__notion-search` scoped to the resolved Domain's Initiatives data source — NOT the global cortex one (cortex Initiatives is frozen post-refactor):

```
mcp__claude_ai_Notion__notion-search({
  query: "<initiative name or keyword>",
  data_source_url: "<resolved domain's Initiatives collection URL>",
  filters: {},
  page_size: 10,
  max_highlight_length: 0
})
```

Initiative names typically follow `<Domain> – <Name>` (e.g., `Cogent – ClickUp`, `Coresynq – Posting`, `Rezzy External – FSU`). Cache results in-session.

Initiative page URLs use format: `https://www.notion.so/<page_id_with_dashes_removed>`.

If no matching initiative within the resolved domain, suggest creating one via `/luke-domain` (which also operates per-domain).

## Task ID prefix

Each per-business Tasks DB has its own Task ID auto-increment with prefix: `CGT-` (Cogent), `CSQ-` (Coresynq), `RZY-` (Rezzy), `PER-` (Personal). Cortex Inbox keeps `CTX-` (continued from the pre-refactor cortex Tasks DB). Task ID is auto-generated — do NOT set it.

## Adding New Area Options

If a Coresynq task doesn't fit any existing Area, tell the user and offer to add one via `mcp__claude_ai_Notion__notion-update-data-source` on `collection://fdb7593f-5d8f-4119-8006-da4ed3f5d0d3`. (Cogent / Rezzy / Personal don't have Area fields.)

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion` (or `notion`), and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
