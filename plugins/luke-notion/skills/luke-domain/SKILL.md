---
name: luke-domain
description: Manage Notion taxonomy — add/audit initiatives and domains. Use when user explicitly wants to create a new initiative, add a domain, or audit the taxonomy. NOT for adding tasks (use luke-add).
allowed-tools: mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-update-data-source
---

# Domain & Initiative Management

Explicitly invoked skill for taxonomy changes. Heavy guardrails — these operations affect all other Luke skills.

## Initiatives DB

- **DB ID:** `0b32261c-5766-4cbe-bb64-83d8e62f9cfe`
- **Data source:** `collection://28a0a1b7-d639-4e34-898f-e19415823dec`

### Schema

| Property | Type | Options |
|---|---|---|
| Name | title | `<Domain> – <Name>` format with en-dash (`–`, not `-`) |
| Domain | select | Cogent, Coresynq, Rezzy, Personal |
| Type | select | Internal Project, External Client, Catch-all |
| Status | select | active, paused, done, archived |
| Description | rich_text | free-form |

## Commands

### Add Initiative

"Add a new initiative to Rezzy called 'Analytics V3'"

1. Confirm Domain and Name with user.
2. Check if the initiative already exists via `notion-search` scoped to the Initiatives data source.
3. Create via MCP:
   ```
   mcp__claude_ai_Notion__notion-create-pages({
     parent: { type: "data_source_id", data_source_id: "28a0a1b7-d639-4e34-898f-e19415823dec" },
     pages: [{
       properties: {
         "Name": "Rezzy – Analytics V3",
         "Domain": "Rezzy",
         "Type": "Internal Project",
         "Status": "active",
         "Description": "Optional one-liner."
       }
     }]
   })
   ```
4. Confirm: "Created initiative: Rezzy – Analytics V3."

No local index to refresh — all other skills resolve initiatives live via `notion-search`.

### Add Domain

Rare. Full setup checklist — walk user through, don't auto-execute:

1. Create teamspace in Notion (user does this in the Notion UI).
2. Add the new Domain option to Initiatives DB's `Domain` select via `notion-update-data-source` with `ALTER COLUMN`.
3. Add the same option to Meetings DB's `Domain` select (same approach).
4. Create catch-all initiative `<Domain> – General`.
5. (Optional) Set up a domain home page in the new teamspace: subpages for each initiative + a linked Tasks DB + a linked Meetings DB filtered to this Domain + page-level access rule on the Tasks DB (`Assignee → Can view`).

No `notion-write.ts` routing change needed — all tasks go to the single canonical cortex Tasks DB regardless of domain.

### Audit

Check the taxonomy for common problems. Use MCP search, not a local file.

- **Orphan initiatives** (zero tasks AND zero meetings pointing to them): `notion-search` the Initiatives data source for all active rows, then for each one spot-check its relation-back count via `notion-query-database-view` on cortex Tasks / Meetings views. For a rough check, ask the user — they usually know.
- **Missing catch-all** (every Domain should have `<Domain> – General`): fetch all initiatives via search, group by Domain, flag any domain without a `General`.
- **Domain mismatch** (initiative Name prefix doesn't match its Domain select): iterate and flag.

## Taxonomy Principles

- **Containers aren't initiatives.** Sub-projects are initiatives; containers are Notion pages with filtered views. Example: "Deck" is a container with sub-projects AI Engine / Travel Hub / Messaging / Film Analysis — the sub-projects are initiatives, Deck is not.
- **Leaf workstreams are initiatives.** If you're creating tasks for it, it's an initiative.
- **Domain = Teamspace (1:1).** Every domain maps to exactly one teamspace.
- **En-dash separator.** Initiative names use ` – ` (en-dash), not ` - ` (hyphen).
- **Catch-all per domain.** Every domain has a `<Domain> – General` for unclassified work.
