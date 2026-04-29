# coresynq-team

Claude Code plugin for working with Coresynq tasks in Notion. Add, view, and complete tasks by talking to Claude.

Backed by a private MCP server. You need a **team key** from Collin to use it. See [`docs/install.md`](docs/install.md) for setup — takes about 3 minutes.

## What you get (depends on your role)

- **Noob:** add tasks for `coresynq` or `epcr`, see your own tasks, mark them done.
- **Co-dev:** full read/write across Coresynq-domain tasks for the whole team — update priorities, reassign, change initiatives, etc.

You don't pick your role — your team key determines what's available. Run "who am I?" in chat to verify the install. Run "what can you do?" to see the tools you have.

## Skills included

- `add-task` — create new tasks against the `coresynq` or `epcr` projects
- `my-tasks` — list your own open tasks
- `complete-task` — mark your tasks done by Task ID
- `coresynq-tasks` (co-dev only) — list / filter / update / complete tasks across the team
