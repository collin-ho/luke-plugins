# luke-notion

Task and meeting workflow skills for Collin's canonical Notion workspace.

## Prerequisites

- **Claude Code installed + Notion MCP connector authenticated** — for all existing skills (luke-add, luke-edit, etc). Configure via Settings → MCP → claude.ai Notion.
- **Access to the canonical Notion workspace** — cortex Tasks DB `4de35153`, Meetings DB `9d019a9f`, Initiatives DB `0b32261c-5766-4cbe-bb64-83d8e62f9cfe`.
- **Node 18+ on PATH** — new in v0.2.0, required by the bundled MCP server that powers `/luke-dump`. Verify: `node --version`.
- **NOTION_TOKEN** — new in v0.2.0. Create an internal integration at https://www.notion.so/my-integrations. Grant it access to the canonical DBs (Tasks `4de35153`, Meetings `9d019a9f`, Initiatives `0b32261c-5766-4cbe-bb64-83d8e62f9cfe`) via each DB's ••• → Connections → Add. The token is then either supplied via the plugin install prompt (stored in macOS Keychain) or exported as `NOTION_TOKEN=ntn_...` in your shell.

## Skills

| Skill | Purpose |
|---|---|
| `/luke-add` | Capture a new task in the canonical Tasks DB |
| `/luke-tasks` | List / search tasks, with domain-aware filtering |
| `/luke-edit` | Update properties on an existing task |
| `/luke-done` | Mark a task Done |
| `/luke-dump` | Exhaustively enumerate a Notion data source beyond the hosted MCP's 100-row cap. Requires NOTION_TOKEN + integration access. |
| `/luke-domain` | Create or audit Initiatives; add a new Domain (guided) |
| `/luke-meeting-review` | Review a Notion meeting page; produce a local markdown draft |
| `/luke-meeting-commit` | Push a ready-to-commit review draft to Notion (creates tasks + updates meeting properties) |

## Typical flow

1. `/luke-meeting-review <meeting URL or phrase>` → produces `~/.claude/luke/drafts/meeting-reviews/<meeting_id>.md`
2. Review the draft, flip `ready_for_commit: true`
3. `/luke-meeting-commit` → pushes tasks + meeting property updates to Notion

## Draft file location

`luke-meeting-review` writes drafts to `~/.claude/luke/drafts/meeting-reviews/<meeting_id>.md` — a user-global location independent of the Claude Code session's current working directory. `luke-meeting-commit` looks for drafts in the same place. Review and commit always find each other regardless of which repo your session is in.

## Notes

- Task IDs auto-assign with the `CTX-` prefix (single canonical DB).
- MCP update-page has no `in_trash` support — skills use `Status = Archived` (tasks) or `Review Status = Skipped` (meetings) instead of trashing.
- Hardcoded Collin user ID and canonical DB IDs are v1 simplifications — future version will parameterize.
