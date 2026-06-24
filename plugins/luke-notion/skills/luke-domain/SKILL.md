---
name: luke-domain
description: Manage Notion taxonomy — add/audit initiatives within a specific domain. Use when user explicitly wants to create a new initiative, add a domain, or audit the taxonomy. NOT for adding tasks (use luke-add).
allowed-tools: mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-update-data-source
---

# Domain & Initiative Management

Explicitly invoked skill for taxonomy changes. Heavy guardrails — these operations affect all other Luke skills.

## Per-business Initiatives DBs

Initiatives live in 4 per-business DBs — one per teamspace. Teamspace IS the domain; there is no `Domain` field. The Initiatives data-source IDs are in the Notion Brain — read `${CLAUDE_PLUGIN_ROOT}/README.md` §2.

### Schema (same across all 4)

| Property | Type | Options |
|---|---|---|
| Name | title | `<Domain> – <Name>` format with en-dash (`–`, not `-`) — Domain prefix is convention only; the actual domain is the DB the initiative lives in |
| Type | select | Internal Project, External Client, Catch-all |
| Status | select | active, paused, done, archived |
| Description | rich_text | free-form |
| Correlation ID | rich_text | optional |
| Legacy Initiative URL | url | populated by migration only; don't set on new rows |

**Note:** `Domain` field is gone. Don't try to set it. The DB the initiative lives in IS the domain.

## Commands

### Add Initiative

User says: "Add a new initiative to Rezzy called 'Analytics V3'"

1. **Confirm Domain and Name with user.** Domain is required — it picks which DB the initiative goes into.
2. **Check for duplicates** via `notion-search` scoped to that domain's Initiatives data source.
3. **Create via MCP** with the matching data source:
   ```
   mcp__claude_ai_Notion__notion-create-pages({
     parent: { type: "data_source_id", data_source_id: "<that domain's Initiatives ds_id, no collection:// prefix>" },
     pages: [{
       properties: {
         "Name": "Rezzy – Analytics V3",
         "Type": "Internal Project",
         "Status": "active",
         "Description": "Optional one-liner."
       }
     }]
   })
   ```
4. **Confirm:** "Created initiative in Rezzy Initiatives: Rezzy – Analytics V3."

No local index to refresh — all other skills resolve initiatives live via `notion-search`.

### Add Domain (5th+ business)

Rare. If you ever add a 5th business (e.g., a spin-off), full setup checklist — walk user through, don't auto-execute:

1. **Create new teamspace** in Notion (user does this in the Notion UI).
2. **Create `<NewDomain> Tasks` DB** in that teamspace using `notion-create-database` with the standard Tasks schema (Title, Task ID with unique prefix, Status, Due Date, Assignee, Notes, Source Spec, URL, Initiative relation, Legacy Task ID).
3. **Create `<NewDomain> Initiatives` DB** in the same teamspace with the standard Initiatives schema (above).
4. **Wire the Initiative relation** in the new Tasks DB to point at the new Initiatives DB.
5. **Create catch-all initiative** `<NewDomain> – General` in the new Initiatives DB.
6. **Add one anchor row to the Notion Brain** (`README.md` §2) with the new domain's Tasks + Initiatives data-source IDs, and a routing line in §4. The CRUD skills read the Brain, so no per-skill edits are needed.

### Audit

Check the taxonomy for common problems within a specific domain (always specify Domain first):

- **Orphan initiatives** (zero tasks pointing to them): dump the domain's Initiatives via `notion-search`, then for each row check the Tasks DB for matching Initiative relations. For rough checks, ask the user — they usually know.
- **Missing catch-all** (every domain should have `<Domain> – General`): search the domain's Initiatives DB for "General". If missing, suggest creating.
- **Naming convention drift** (initiatives that don't follow `<Domain> – <Name>` with en-dash): list and flag for cleanup.

## Taxonomy Principles

- **Containers aren't initiatives.** Sub-projects are initiatives; containers are Notion pages with filtered views. Example: "Deck" is a container with sub-projects AI Engine / Travel Hub / Messaging / Film Analysis — the sub-projects are initiatives, Deck is not.
- **Leaf workstreams are initiatives.** If you're creating tasks for it, it's an initiative.
- **Domain = Teamspace (1:1).** Every domain maps to exactly one teamspace and one Initiatives DB.
- **En-dash separator.** Initiative names use ` – ` (en-dash), not ` - ` (hyphen).
- **Catch-all per domain.** Every domain has a `<Domain> – General` for unclassified work.
- **No cross-domain initiatives.** Each initiative lives in exactly one domain's Initiatives DB. If something feels cross-domain, either split it into per-domain initiatives or create separate parallel ones.

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion` (or `notion`), and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
