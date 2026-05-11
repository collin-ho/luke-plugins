# coresynq-team

Claude Code skills for the Coresynq team to add, complete, and view tasks in the Coresynq Notion workspace.

## What you get

Four skills under the `coresynq-team` plugin:

- `/coresynq-team:coresynq-add-task` — capture a new task
- `/coresynq-team:coresynq-complete-task` — mark a task done
- `/coresynq-team:coresynq-my-tasks` — list your open tasks
- `/coresynq-team:coresynq-tasks` — full team view

Every mutation (add, complete) writes an audit row to the `Coresynq Changelog` DB for recovery + traceability.

## Install

1. In Claude Code (terminal CLI — desktop app's `/plugin` is currently incomplete, see [anthropics/claude-code#42142](https://github.com/anthropics/claude-code/issues/42142)):

   ```
   /plugin marketplace add collin-ho/luke-plugins
   /plugin install coresynq-team@luke-plugins
   ```

2. Connect Notion via `/mcp` → find `claude.ai Notion` → click to connect, complete the auth flow in your browser.

3. Confirm:

   ```
   /mcp
   ```

   You should see `claude.ai Notion · connected`.

4. Test:

   ```
   /coresynq-team:coresynq-my-tasks
   ```

   Should list your assigned Coresynq tasks (probably empty for new teammates).

## Notion access

Collin will add you to the Coresynq teamspace in Notion. You'll see only Coresynq content — Cogent, Rezzy, and Collin's personal work are in separate teamspaces and not visible to you.

## If your Notion session expires

Skills will tell you. Run `/mcp` → find `claude.ai Notion` → reconnect → retry your last command.

## Questions

Slack-DM Collin.
