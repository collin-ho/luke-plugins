# luke-notion

Task and meeting workflow skills for Collin's canonical Notion workspace. Pure MCP — no scripts, no bundled tokens.

## Prerequisites

- Claude Code installed
- Notion MCP connector authenticated in Claude Code settings (Settings → MCP → claude.ai Notion)
- Access to the canonical Notion workspace (cortex Tasks DB `4de35153`, Meetings DB `9d019a9f`, Initiatives DB `0b32261c`)

## Skills

| Skill | Purpose |
|---|---|
| `/luke-add` | Capture a new task in the canonical Tasks DB |
| `/luke-tasks` | List / search tasks, with domain-aware filtering |
| `/luke-edit` | Update properties on an existing task |
| `/luke-done` | Mark a task Done |
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
