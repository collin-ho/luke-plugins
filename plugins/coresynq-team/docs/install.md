# Install — coresynq-team

This is the plugin that lets you create, complete, and view Coresynq tasks by talking to Claude. Setup is one-time and takes ~3 minutes.

## Before you start

You'll need:

- **Claude Code (terminal CLI).** The `/plugin` command is currently incomplete in the desktop app — see [anthropics/claude-code#42142](https://github.com/anthropics/claude-code/issues/42142). Run `claude` in your terminal.
- **A personal Notion login.** Collin will add you to the Coresynq teamspace.

No team key needed anymore — auth is handled by Notion's own connector.

## Setup

Each step below is something you type into Claude Code's chat input. Press Enter after each.

### 1. Add the marketplace (one-time)

```
/plugin marketplace add collin-ho/luke-plugins
```

Tells Claude Code where to find the plugin. One-time per machine.

### 2. Install the plugin

```
/plugin install coresynq-team@luke-plugins
```

No team-key dialog this time around — auth is via the Notion connector instead.

### 3. Connect Notion via /mcp

```
/mcp
```

In the list, find `claude.ai Notion`. If it shows `· disabled`, select it and follow the connect flow (you'll be redirected to Notion in your browser to authorize). You should end up with `claude.ai Notion · connected`.

### 4. Verify it works

```
/coresynq-team:coresynq-my-tasks
```

Should list your assigned Coresynq tasks (probably empty for new teammates). If you see "no access" or a 404, ping Collin to add you to the Coresynq teamspace.

## What you can do now

Just talk to Claude normally. Some examples:

**Add a task**
> "Add a task to fix the unmatched-claims script"
>
> "Remind me to follow up with the EPCR team about the demo"

**See your tasks**
> "What's on my plate?"
>
> "Show me my Coresynq tasks"

**Mark something done**
> "Mark CSQ-1234 as done"
>
> "I finished the demo prep, complete that task"

You don't need to remember exact command names — just describe what you want and Claude will pick the right tool.

## What happens behind the scenes

Every time you add or complete a task, the skill ALSO writes a row to the **Coresynq Changelog** DB in Notion. This is a full audit trail of who did what and when. You can see it in the Coresynq teamspace.

This isn't an attempt to be punitive — it's a safety net. If someone accidentally deletes or overwrites something, we can recover from the log. Operate normally.

## When something doesn't work

| What you see | What it means | What to do |
| :--- | :--- | :--- |
| `Your Notion session expired` | The Notion connector lost its token | Run `/mcp`, find `claude.ai Notion`, reconnect |
| `404` or `Could not find database` | You haven't been added to the Coresynq teamspace yet | Ping Collin |
| Rate-limit errors | Notion is being slow | Wait a few seconds and try again |
| Skill output looks weird / outdated | Plugin might be stale | `/plugin update coresynq-team@luke-plugins`, then quit + restart Claude Code |
| Anything else | Genuine bug | Send Collin the full error text + what you typed |

## Updating the plugin

When Collin pushes a new version:

```
/plugin update coresynq-team@luke-plugins
```

Then restart Claude Code to pick up the changes.

## Uninstalling

```
/plugin uninstall coresynq-team@luke-plugins
```
