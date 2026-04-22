---
name: luke-meeting-commit
description: Push a meeting review draft to Notion — creates tasks in the canonical Tasks DB and updates meeting properties. ALWAYS use this skill after luke-meeting-review produces a draft flagged ready_for_commit. MCP-native — no local scripts required.
allowed-tools: Read, Write, Edit, Bash, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-get-users
---

# Meeting Commit Skill

Pure-MCP writer that pushes a curated review draft to Notion. Requires `frontmatter.ready_for_commit: true`. Idempotent — re-running on an already-committed draft no-ops.

## Canonical DBs

- **Tasks data source:** `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79`
- **Meetings data source:** `collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c`
- **Initiatives data source:** `collection://28a0a1b7-d639-4e34-898f-e19415823dec`
- **Collin user ID:** `1b1d872b-594c-81d5-8ae2-00027cffc129` (confirm via `notion-get-users` if ever in doubt)

## Execution

### Step 1: Locate and read the draft

If the user supplies a path, use it. Otherwise find the most recent draft in the user-global draft directory:

```bash
ls -t ~/.claude/luke/drafts/meeting-reviews/*.md | head -1
```

This location is fixed — independent of the Claude Code session's current working directory. If no files exist there, bail with "No review drafts found. Run `/luke-meeting-review` first."

Read the draft with the `Read` tool. Parse the YAML frontmatter (between `---` markers) and the body.

### Step 2: Safety gates

- If `frontmatter.ready_for_commit !== true` → bail: "Flip `ready_for_commit: true` before committing."
- If `frontmatter.committed_at` is set → bail: "Already committed at <committed_at>. No-op."

### Step 3: Parse tasks from body

Tasks live under `## Tasks (curated — 🟢 keep)`. Each task block starts with `### N. Title` and contains dashed `key: value` lines:

| Field | Required | Default | Notes |
|---|---|---|---|
| `initiative` | yes | — | Full name, e.g. `Cogent – ClickUp` |
| `priority` | no | `P2` | P0 / P1 / P2 / P3 |
| `status` | no | `To Do` | Backlog / To Do / In Progress / Pending Review / Blocked / Done / Archived |
| `due` | no | — | `YYYY-MM-DD` |
| `assignee` | no | — | Notion user ID |
| `area` | no | — | Coresynq only, array |
| `client` | no | — | Rezzy only, single select |
| `source` | no | `review-conversation` | transcript-quote / review-conversation / ai-cross-ref |
| `source_spec` | no | — | Spec file path when the task derives from a spec doc |
| `notes` | no | — | Multi-line via `notes: \|` block, indented 4 spaces |

### Step 4: Dry-run preview

Show the user:
- Each task with its Initiative, Status, Priority, Due.
- Meeting property updates (Title, Domain, Initiative relation, Summary, Date, Review Status → Reviewed).
- Ask: "Push to Notion? (y/n)"

Don't proceed without `y`.

### Step 5: Resolve initiative page IDs

Collect the distinct initiative names from the parsed tasks AND `frontmatter.triage.initiatives.primary` AND `.secondary` (if set).

For each distinct name, search:

```
mcp__claude_ai_Notion__notion-search({
  query: "<initiative name>",
  data_source_url: "collection://28a0a1b7-d639-4e34-898f-e19415823dec",
  filters: {},
  page_size: 5,
  max_highlight_length: 0
})
```

Pick the exact-name match (initiative names are unique). Build a map `{name → page_id}`. If a name doesn't resolve, bail and tell the user — don't silently fall back.

Initiative page URL format for relations: `https://www.notion.so/<page_id_with_dashes_removed>`.

### Step 6: Create tasks (single batched call)

```
mcp__claude_ai_Notion__notion-create-pages({
  parent: { type: "data_source_id", data_source_id: "b0d00fd8-eebb-434d-84c1-a652260fbe79" },
  pages: [
    {
      properties: {
        "Title": "<task title>",
        "Initiative": "[\"https://www.notion.so/<initiative_id_no_dashes>\"]",
        "Related Meeting": "[\"https://www.notion.so/<meeting_id_no_dashes>\"]",
        "Status": "<status>",
        "Priority": "<priority>",
        "Notes": "<notes>",
        // optional:
        "date:Due Date:start": "<due>",
        "date:Due Date:is_datetime": 0,
        "Assignee": "[\"<user_id>\"]",
        "Area": "[\"Billing\",\"Claims\"]",
        "Client": "Duke",
        "Source Spec": "<source_spec>"
      }
    },
    // ... one object per task
  ]
})
```

Single call = atomic per-batch. If it fails, no tasks get created; user can fix and retry safely. Capture the returned `id`s.

### Step 7: Update meeting properties

```
mcp__claude_ai_Notion__notion-update-page({
  page_id: "<meeting_id>",
  command: "update_properties",
  properties: {
    "Title": "<fm.triage.title>",
    "Domain": "<fm.triage.domain>",
    "Initiative": "[\"<primary_url>\"]",  // append secondary URL to the array if set
    "Summary": "<fm.summary>",
    "Review Status": "Reviewed",
    "date:Date:start": "<fm.triage.date>",
    "date:Date:is_datetime": 1,
    "Attendees": "[\"1b1d872b-594c-81d5-8ae2-00027cffc129\"]"
  },
  content_updates: []
})
```

Note: overwriting `Attendees` to just Collin is a v1 simplification. If the meeting has real human attendees we want to preserve, capture them from the meeting's existing `Attendees` during Step 1 and merge.

### Step 8: Mark draft as committed

Update the draft's frontmatter:

```yaml
committed_at: <current ISO datetime>
notion_writes:
  tasks: [<created task id>, ...]
  meeting_page_updated: true
  review_log_appended: false   # intentionally skipped — draft file IS the audit trail
```

Use the `Write` tool to rewrite the file.

### Step 9: Confirm

Show user:
- N tasks created with their Notion URLs.
- Meeting page URL.
- Reminder: draft is marked committed — re-running will no-op.

## Failure Handling

- Initiative name doesn't resolve → bail, tell user which one. Don't create partial state.
- `notion-create-pages` fails → tell user, don't mark draft committed. Safe to retry.
- `notion-update-page` fails after tasks created → tasks exist in Notion, but draft is not marked committed. On retry: Step 2 will bail with "already committed" only if we set `committed_at` too early. We don't — we only set `committed_at` AFTER both creates and meeting update succeed. So retry creates duplicate tasks. Mitigation: if Step 6 succeeded but Step 7 failed, tell user which task IDs already exist and ask them to trash them before retry.

## Review log — intentionally skipped

The original flow appended a `## Meeting Review Log` section to the meeting page content. MCP's page content editing is search-and-replace, making append clunky. The draft file on disk with `committed_at` set IS the audit trail — that's sufficient. If user wants a log on the Notion page, they can add it manually via Notion AI.
