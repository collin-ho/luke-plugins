---
name: luke-meeting-commit
description: Push a meeting review draft to Notion — creates tasks in the per-business Tasks DBs and updates meeting properties. ALWAYS use this skill after luke-meeting-review produces a draft flagged ready_for_commit. MCP-native — no local scripts required.
allowed-tools: Read, Write, Edit, Bash, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-get-users
---

# Meeting Commit Skill

Pure-MCP writer that pushes a curated review draft to Notion. Requires `frontmatter.ready_for_commit: true`. Idempotent — re-running on an already-committed draft no-ops.

## Per-business Tasks + Initiatives DBs

Tasks from a meeting review go to the per-business Tasks DB matching each task's domain (derived from its `initiative` name prefix). Initiative names follow `<Domain> – <Name>` format.

| Domain | Tasks data source | Initiatives data source |
|---|---|---|
| Cogent | `e71b583f-242f-4b16-9dfa-d9a8d82949b8` | `9afa9c00-6eda-49c9-b022-f77656adff97` |
| Coresynq | `fdb7593f-5d8f-4119-8006-da4ed3f5d0d3` | `2da4502c-9651-4d39-b837-0f5996b32209` |
| Rezzy | `dde1524b-f5da-44a4-8c89-3479f180cc9d` | `ef52d445-66b4-4619-bdf1-903ac0f977f0` |
| Personal | `a405e3f1-7196-4e23-afa4-c64f54c08ff7` | `5189917d-6eb0-4802-88ee-faa36378b085` |

## Other canonical IDs

- **Meetings data source (cortex, collin-only):** `db2e5ca6-92b7-4e39-ab23-f4c496d2636c`
- **Collin user ID:** `1b1d872b-594c-81d5-8ae2-00027cffc129` (confirm via `notion-get-users` if ever in doubt)

## Execution

### Step 1: Locate and read the draft

If the user supplies a path, use it. Otherwise find the most recent draft:

```bash
ls -t ~/.claude/luke/drafts/meeting-reviews/*.md | head -1
```

If no files exist, bail with "No review drafts found. Run `/luke-meeting-review` first."

Read with `Read`. Parse YAML frontmatter and body.

### Step 2: Safety gates

- If `frontmatter.ready_for_commit !== true` → bail: "Flip `ready_for_commit: true` before committing."
- If `frontmatter.committed_at` is set → bail: "Already committed at <committed_at>. No-op."

### Step 3: Parse tasks from body

Tasks live under `## Tasks (curated — 🟢 keep)`. Each task block starts with `### N. Title` and contains dashed `key: value` lines:

| Field | Required | Default | Notes |
|---|---|---|---|
| `initiative` | yes | — | Full name with domain prefix, e.g. `Cogent – ClickUp`. Drives both target Tasks DB and Initiative relation. |
| `priority` | no | `P2` | P0 / P1 / P2 / P3 |
| `status` | no | `To Do` | Backlog / To Do / In Progress / Pending Review / Blocked / Done / Archived |
| `due` | no | — | `YYYY-MM-DD` |
| `assignee` | no | — | Notion user ID |
| `area` | no | — | Coresynq-domain tasks only, array |
| `client` | no | — | Rezzy-domain tasks only, single select |
| `source` | no | `review-conversation` | transcript-quote / review-conversation / ai-cross-ref |
| `source_spec` | no | — | Spec file path when the task derives from a spec doc |
| `notes` | no | — | Multi-line via `notes: \|` block, indented 4 spaces |

### Step 4: Group tasks by target domain

Derive each task's target Domain from its `initiative` name prefix:
- `Cogent – ...` → Cogent
- `Coresynq – ...` → Coresynq
- `Rezzy – ...` or `Rezzy External – ...` → Rezzy
- `Personal – ...` → Personal

Bucket tasks into per-domain groups. Each group will be one `notion-create-pages` call.

### Step 5: Dry-run preview

Show the user:
- Each task with its target DB (e.g., "Coresynq Tasks"), Initiative, Status, Priority, Due.
- Meeting property updates (Title, Domain, Initiative relation if mentioned, Summary, Date, Review Status → Reviewed).
- Per-domain Tasks-relation updates that will be written on the meeting page after creation.
- Ask: "Push to Notion? (y/n)"

Don't proceed without `y`.

### Step 6: Resolve initiative page IDs (per domain)

For each domain group, collect distinct initiative names. Search the matching per-business Initiatives DB:

```
mcp__claude_ai_Notion__notion-search({
  query: "<initiative name>",
  data_source_url: "collection://<that domain's Initiatives ds_id>",
  filters: {},
  page_size: 5,
  max_highlight_length: 0
})
```

Pick the exact-name match. Build per-domain maps `{name → page_id}`. If any name doesn't resolve in the expected domain's DB, bail and tell the user — don't silently fall back to another domain.

Initiative page URL format for relations: `https://www.notion.so/<page_id_with_dashes_removed>`.

### Step 7: Create tasks (one batched call per domain)

For each domain group with at least one task:

```
mcp__claude_ai_Notion__notion-create-pages({
  parent: { type: "data_source_id", data_source_id: "<that domain's Tasks ds_id>" },
  pages: [
    {
      properties: {
        "Title": "<task title>",
        "Initiative": "[\"https://www.notion.so/<initiative_id_no_dashes>\"]",
        "Status": "<status>",
        "Priority": "<priority>",
        "Notes": "<notes>",
        // optional:
        "date:Due Date:start": "<due>",
        "date:Due Date:is_datetime": 0,
        "Assignee": "[\"<user_id>\"]",
        // Coresynq tasks only:
        "Area": "[\"Billing\",\"Claims\"]",
        // Rezzy tasks only:
        "Client": "Duke",
        // optional:
        "Source Spec": "<source_spec>"
      }
    }
    // ... one object per task in this domain group
  ]
})
```

**Do NOT** set `Related Meeting` — the relation is meeting-side only post-refactor. The Meeting page has per-domain Tasks relations that we'll update in Step 8.

Capture the returned `id` and `url` for each new task, keyed by domain.

### Step 8: Update meeting properties + per-domain task relations

```
mcp__claude_ai_Notion__notion-update-page({
  page_id: "<meeting_id>",
  command: "update_properties",
  properties: {
    "Title": "<fm.triage.title>",
    "Domain": "<fm.triage.domain>",
    // optional — only if meeting has its own Initiative (still points at frozen cortex Initiatives):
    "Initiative": "[\"<primary_url>\"]",
    "Summary": "<fm.summary>",
    "Review Status": "Reviewed",
    "date:Date:start": "<fm.triage.date>",
    "date:Date:is_datetime": 1,
    "Attendees": "[\"1b1d872b-594c-81d5-8ae2-00027cffc129\"]",
    // Per-domain task relations — write the new task URLs to the matching relation column:
    "Cogent Tasks": "[\"<cogent_task_1_url>\",\"<cogent_task_2_url>\"]",
    "Coresynq Tasks": "[\"<coresynq_task_1_url>\"]",
    "Rezzy Tasks": "[]",
    "Personal Tasks": "[]"
  },
  content_updates: []
})
```

Only include the per-domain Tasks relation property if that domain had tasks created. Omit empty arrays where convenient.

Note: the meeting page's optional legacy `Initiative` field referenced a now-frozen cortex Initiatives DB (`28a0a1b7`, 404) — treat that field as deprecated and don't set it. Per-business initiative links live in the `X Initiative` relations.

Note: overwriting `Attendees` to just Collin is a v1 simplification. If the meeting has real human attendees we want to preserve, capture them from the meeting's existing `Attendees` during Step 1 and merge.

### Step 9: Mark draft as committed

Update the draft's frontmatter:

```yaml
committed_at: <current ISO datetime>
notion_writes:
  tasks:
    cogent: [<created task ids>]
    coresynq: [<created task ids>]
    rezzy: [<created task ids>]
    personal: [<created task ids>]
  meeting_page_updated: true
  review_log_appended: false   # intentionally skipped — draft file IS the audit trail
```

Use `Write` to rewrite the file.

### Step 10: Confirm

Show user:
- Per-domain task counts with their Notion URLs.
- Meeting page URL.
- Reminder: draft is marked committed — re-running will no-op.

## Failure Handling

- Initiative name doesn't resolve in expected domain → bail, tell user which one + which domain. Don't create partial state.
- `notion-create-pages` fails on one domain → tell user, don't mark draft committed. Other domain groups that succeeded BEFORE the failure exist in Notion. To retry safely: have user manually trash the partial successes, or accept duplicates on retry. Recommend ordering: process the largest domain group LAST so partial failures are smaller.
- `notion-update-page` fails after tasks created → tasks exist in Notion, but draft is not marked committed. On retry: Step 2 will pass (no `committed_at` yet), Steps 6-7 will recreate all tasks (duplicates). Mitigation: tell the user which task IDs exist; ask them to trash before retry.

## Review log — intentionally skipped

The original flow appended a `## Meeting Review Log` section to the meeting page content. MCP's page content editing is search-and-replace, making append clunky. The draft file on disk with `committed_at` set IS the audit trail. Sufficient.

## Reauth handling

If any `mcp__claude_ai_Notion__*` call returns a 401-style error or "Could not find" permission failure:

1. Tell the user: "Your Notion session expired. Open `/mcp` in Claude Code, find `claude.ai Notion` (or `notion`), and reconnect. Then retry your last action."
2. Do NOT proceed — wait for the user to confirm reconnection.
3. After they confirm, retry the original tool call once.
