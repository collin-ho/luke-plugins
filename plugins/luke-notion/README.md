# luke-notion — the Notion Brain

**Single source of truth** for how agents (and Collin) operate Notion. Anchors, routing, the task model, preferences, and CLI recipes/gotchas all live here. Memories and CLAUDE.md hold **no** Notion logic — they point at this file. Read this before any Notion operation.

> On-demand principle: this file pins only **stable** things (IDs, routing rules, operation recipes). It never pins **volatile** data — which initiatives exist, Area option values, schema, counts. Those drift; resolve them live every time.

---

## 1. Access model — what sees what

One active workspace: **Studio** (`b0ba8da7-9444-46ea-96e0-d61f60e5415f`). (An older workspace exists but is unused — ignore it.)

| Path | What it is | Sees | Use for |
|---|---|---|---|
| **`ntn login`** (keychain) | User-scoped OAuth token (`owner.type=user`) | **Everything you can see in Studio — no per-DB sharing** | Commands, bulk/pagination, raw API, Workers |
| **Hosted MCP** (`mcp.notion.com`, via claude.ai connector) | OAuth connector, ~17 AI-tuned tools | Everything you can see, cross-workspace | Semantic search, content CRUD where a tool fits |
| ~~`NOTION_TOKEN` / "Mac-mini" integration~~ | **RETIRED** | — | (was the dump server; gone — `ntn` paginates natively) |

`ntn login` does **not** require sharing DBs with it — that was the old integration-token friction, now retired. `NOTION_API_TOKEN` (if set) overrides the keychain. Confirm with `ntn doctor` (workspace should be Studio).

---

## 2. Structure — the anchors

Studio holds these. **IDs are the only durable anchors** — everything *inside* the DBs (initiatives, options, schema) is resolved on demand.

**Cortex Inbox** — `db 4de35153-f31d-4427-bc5a-1c3b1c08648e` / `ds b0d00fd8-eebb-434d-84c1-a652260fbe79`
→ Universal **intake / triage** (ambiguous or untriaged tasks). **NOT** an aggregate Tasks DB — there is no aggregate.

**Per-business Tasks + Initiatives** (data source IDs):
| Domain | Tasks ds | Initiatives ds |
|---|---|---|
| Coresynq | `fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` | `2da4502c-9651-4d39-b837-0f5996b32209` |
| Cogent | `e71b583f-242f-4b16-9dfa-d9a8d82949b8` | `9afa9c00-6eda-49c9-b022-f77656adff97` |
| Rezzy | `dde1524b-f5da-44a4-8c89-3479f180cc9d` | `ef52d445-66b4-4619-bdf1-903ac0f977f0` |
| Personal | `a405e3f1-7196-4e23-afa4-c64f54c08ff7` | `5189917d-6eb0-4802-88ee-faa36378b085` |

**Meetings** — `db 9d019a9f-235f-4ecc-af82-8695a99859da` / `ds db2e5ca6-92b7-4e39-ab23-f4c496d2636c` — hub; cross-links to all per-business Tasks + Initiatives.

**Collin (user)** — `1b1d872b-594c-81d5-8ae2-00027cffc129`

**Transient DBs (NOT anchors — name them ad-hoc when working them):** Coresynq Changelog `44234af9-c9e6-464c-adfd-fa87ab8c6bdb`; ARS Setup Bug & Issue Log `db 9f6f0773fae9422fa7f23bff6783253b` / `ds 2ba2157a-d6de-4f29-9dc2-b355294d7737`.
**Dead (never reference):** frozen cortex Initiatives `28a0a1b7`, old single Initiatives `0b32261c` (both 404/stale).

---

## 3. Model & lifecycle

Capture → **(Cortex Inbox if domain ambiguous)** → triaged into the per-business Tasks DB → linked to its Initiative (and Meeting, if from a review). Known-domain captures go **straight** to the per-business DB; only ambiguous ones sit in Inbox. Tasks are split across 4 separate DBs — "enumerate everything" fans out per business; there is no single DB to dump.

---

## 4. Routing (small + firm; explicit otherwise)

**Surfacing/reading information is the priority. Adding is easy — just be explicit.**

Repo/cwd → domain (the only auto-map):
- `EMS-billing` / `ems-billing` → **Coresynq**
- `MFTtool-v2` / `MFR` / `docebo-cogent-uni` / `CUv10demo` / `teams-clickup-integration` / `hubspot` → **Cogent**
- `rezzy-analytics` → **Rezzy**
- **anything else → Personal** (catch-all fallthrough)

New Cogent repos appear over time — **be explicit** ("add to Cogent / ClickUp") and it routes fine; unknown repos fall through to Personal. *Optional:* for an unknown repo, the agent may resolve live initiatives across domains and **suggest** a home — never auto-file on a guess. Within a domain, resolve the initiative **live** from that domain's Initiatives ds.

---

## 5. Preferences

- **Priority: never set it.** (Dropped entirely — Collin doesn't use it.)
- **Status default: `To Do`** (exists in all DBs). ⚠️ **Cogent's "Done" is `_Done`** (underscore) — resolve the Done value per-DB before writing, don't hardcode `Done`.
- Status options (validated, 4/5 identical): `Backlog / To Do / In Progress / Pending Review / Blocked / Done / Archived`.
- Initiative naming: `<Domain> – <Name>` (en-dash).
- **Schema/option changes are gated** (add select option, rename column, retype) → flag to Collin, never auto. Row content writes → direct.
- Area / status / initiative **option lists are resolved on demand** — never pinned here.

---

## 6. CLI recipes & gotchas

Generic CLI knowledge is self-documenting (`ntn api ls`, `ntn api <path> --docs|--spec`; install Notion's official `notion-cli` skill). This section pins only the **shortcuts we've already paid for** — append new ones as they surface.

**Read / surface** (the important half):
- Query a DB: `ntn datasources query <data-source-id> --filter '{...}' --limit 100` — `--start-cursor <c>` to page past 100 (no row cap; replaces the old dump server).
- Resolve a database id → its data source(s): `ntn datasources resolve <database-id>` (query needs a **data-source** id, not a database id).
- Or semantic: hosted MCP `notion-search`.

**Write:**
- New row: `ntn api -X POST v1/pages -d '{"parent":{"data_source_id":"<ds>"},"properties":{...}}'` — or hosted MCP `notion-create-pages`.
- **Set a property (e.g. Status) — the recurring gotcha:** there is **no `ntn pages` command for properties.** Use `ntn api -X PATCH v1/pages/<page_id> -d '{"properties":{"Status":{"select":{"name":"To Do"}}}}'` — read the schema first for exact property names/types. Or hosted MCP `notion-update-page` (cleanest for a single property).
- `ntn pages get|create|edit` = page **content (Markdown) only**, never properties; `edit` wipes-and-replaces the body.

**Gotchas:**
- **Cogent Done = `_Done`** (not `Done`).
- **Schema/option changes are auto-mode gated** → flag to Collin, don't attempt.
- **Background/subagent external writes are blocked** — the classifier denies Notion writes (ntn PATCH / MCP update) from bg/subagents, and relaying a write to the main session is blocked as "permission laundering." Only a **direct in-session instruction** clears it. Architect bg agents to produce a ledger; run the writes in-session.
- Disambiguate methods: `ntn api <path> --docs` errors if a path has multiple methods — pass `-X <METHOD>`.

---

## 7. Skills in this plugin

- **`luke-add` / `luke-tasks` / `luke-edit` / `luke-done` / `luke-domain`** — task/initiative CRUD. They **read this Brain** for anchors, routing, and conventions; they do **not** hardcode IDs.
- **`luke-meeting-review` / `luke-meeting-commit`** — meeting → task pipeline. **Kept as-is** (a separate future refactor will rework them).
- ~~`luke-dump`~~ — **retired**; `ntn datasources query` paginates natively.

Generic CLI operation knowledge comes from Notion's official **`notion-cli`** skill (`npx skills add makenotion/skills`) — this Brain is only the Collin-specific layer on top.

---

## 8. Replication runbook (new machine)

Git carries the plugin (skills + this Brain). The machine-local pieces do **not** travel — do these by hand:

1. `git pull` this repo; refresh the plugin in Claude Code; symlink into Cursor (`~/.cursor/skills/...`).
2. Install the official CLI skill: `npx skills add makenotion/skills -g`.
3. `ntn login` (or set `NOTION_API_TOKEN`); verify `ntn doctor` shows workspace **Studio**.
4. **Memories** (`~/.claude/projects/.../memory/`) — delete the stale/wrong Notion memories and strip Notion logic per the change-list; everything durable already lives here.
5. **Global CLAUDE.md** (`~/.claude/CLAUDE.md` on M4, `~/AGENTS.md` on M5) — replace Notion task-routing with a one-line pointer to this Brain.
6. **Project CLAUDE.md** (in each app repo, e.g. EMS-billing) — the "Skill Routing — Notion" section is a pointer to this Brain (carried by that repo's git).

---

## 9. Maintenance

- **Never pin volatile data** (initiatives, Area values, schema, counts) — resolve live.
- **Grow the gotchas** (§6) whenever a new CLI quirk surfaces — pay the discovery cost once.
- Adding a business/domain: add one anchor row in §2 + one routing line in §4. That's it — the CRUD skills read from here.
