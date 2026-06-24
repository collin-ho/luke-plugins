---
name: luke-add
description: ALWAYS invoke this skill for creating tasks. Routes a new task to the right per-business Tasks DB. Reads the Notion Brain (luke-notion README) for anchors/routing/conventions. NOT for pushing meeting review drafts — use /luke-meeting-commit.
allowed-tools: Bash, Read, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-data-source
---

# Add Task Skill

Capture a task and route it to the right per-business Tasks DB. **All anchors (data-source IDs), the repo→domain map, the task model, and conventions live in the Notion Brain** — read `${CLAUDE_PLUGIN_ROOT}/README.md` for any ID or routing detail. This skill is the *how*; the Brain is the *what*. Never hardcode IDs here.

## Routing (Brain §4)

Resolve the domain in this order:
1. **Explicit mention** — "add to coresynq", "cogent task for clickup" → that domain.
2. **Repo/cwd** — infer from the Brain's repo→domain map (unknown repos fall through to Personal).
3. **Conversation context** — what we've been working on.
4. **Ambiguous** — land in **Cortex Inbox** (untriaged). Do NOT guess.

Quick and clean — he's capturing something, don't slow him down. **Always announce** where it landed ("Adding to Coresynq Tasks — Coresynq – Posting", or "Adding to Cortex Inbox — untriaged"); he can redirect before creation.

## Properties

| Property | Default | Notes |
|---|---|---|
| Title | *(from user)* | Short, action-oriented |
| Status | `To Do` | Override only if user says backlog/blocked |
| Initiative | *(inferred or asked)* | Relation to the resolved domain's Initiatives DB. Empty only for Cortex Inbox. |
| Assignee | *(empty)* | Set if a person is named |
| Due Date | *(empty)* | `date:Due Date:start` if a date is mentioned |
| Notes | *(from context)* | 3–5 sentences |
| Source Spec | *(empty)* | Set if the task derives from a spec doc |

**Never set:** `Priority` (Collin doesn't use it), `Domain` (doesn't exist — teamspace IS the domain), `Related Meeting` (relation is meeting-side only), `Task ID` (auto, per-DB prefix).

**Domain-specific (resolve options on-demand — never memorize them):**
- **Coresynq** — infer 1–2 `Area` values; fetch the live Area options from the Coresynq Tasks schema rather than assuming a list. Ask if no fit.
- **Rezzy** — set `Client` (a school) if mentioned; initiative naming `Rezzy – <Project>` (internal) or `Rezzy External – <School>`.
- **Cogent / Personal** — canonical set only; no Area/Client.

## Execution

1. Parse intent → title, domain, initiative, assignee, notes, due.
2. From the Brain (§2), get the resolved domain's **Tasks** data-source ID. Resolve the **Initiative** live via `notion-search` scoped to that domain's **Initiatives** ds (initiatives drift — always resolve, never pin):
   ```
   mcp__claude_ai_Notion__notion-search({ query: "<initiative name>", data_source_url: "<domain Initiatives collection URL>", filters: {}, page_size: 10, max_highlight_length: 0 })
   ```
   Initiative names follow `<Domain> – <Name>` (e.g. `Coresynq – Posting`). Initiative page URL format: `https://www.notion.so/<page_id_no_dashes>`.
3. Announce the destination.
4. Create:
   ```
   mcp__claude_ai_Notion__notion-create-pages({
     parent: { type: "data_source_id", data_source_id: "<domain Tasks ds UUID, no collection:// prefix>" },
     pages: [{ properties: {
       "Title": "...", "Status": "To Do",
       "Initiative": "[\"<initiative_page_url>\"]",   // omit entirely for Cortex Inbox
       "Notes": "...",
       // Coresynq only: "Area": "[\"Billing\"]"
       // Rezzy only:    "Client": "Duke"
     }}]
   })
   ```
5. Confirm where it landed.

If no initiative matches in the resolved domain, offer `/luke-domain` to create one.

## Adding a new Area option (gated)

If a Coresynq task fits no existing Area, **do not add it silently** — schema/option changes are auto-mode gated (Brain §5/§6). Tell Collin and let him add it, or run `notion-update-data-source` only on his direct in-session instruction.

## Reauth

If a `mcp__claude_ai_Notion__*` call returns 401 / "Could not find": tell the user to reconnect `claude.ai Notion` via `/mcp`, wait, then retry once.
