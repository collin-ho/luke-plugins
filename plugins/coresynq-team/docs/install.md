# Install — coresynq-team

This is the plugin that lets you create and complete Coresynq tasks by talking to Claude. Setup is one-time and takes ~3 minutes.

## Before you start

You'll need:
- **Claude Code** open. Either the desktop app on your Mac, or the terminal version — both work the same.
- **Your team key** from Collin. It's a long random string. He sends it to you over a secure channel (Signal, 1Password share, etc.). Don't paste it into email or Slack.

If you don't have your team key yet, message Collin and he'll generate one for you.

## Setup

Each step below is something you type into Claude Code's chat input. Press Enter after each one. Wait for it to finish before typing the next one.

### 1. Add the marketplace (one-time)

```
/plugin marketplace add collin-ho/luke-plugins
```

This tells Claude Code where to find the plugin. You only do this once on this machine — even if you reinstall the plugin later, you don't redo this step.

### 2. Install the plugin

```
/plugin install coresynq-team@luke-plugins
```

Claude Code will pop up a dialog titled **"Team key"** with a masked input field. **Paste your team key from Collin and press OK.**

The key is stored securely in your Mac's Keychain. You won't be asked for it again on this machine.

### 3. Verify it works

In the chat, type:

```
who am I?
```

Claude should respond with your name and email. If it does, you're done.

## What you can do now

Just talk to Claude normally. Some examples:

**Add a task**
> "Add a task to fix the unmatched-claims script for coresynq"
>
> "Remind me to follow up with the EPCR team about the demo"

**See your tasks**
> "What's on my plate?"
>
> "Show me my Coresynq tasks"

**Mark something done**
> "Mark CTX-1234 as done"
>
> "I finished the demo prep, complete that task"

You don't need to remember exact command names — just describe what you want and Claude will pick the right tool.

## What "role" you have

Your team key determines what you can do. There are two roles:

- **Noob** — add tasks, see your own tasks, see all team tasks (read-only), complete your own tasks.
- **Co-dev** — everything noobs can do, plus update/reassign/complete tasks across the whole team.

You don't choose your role. Collin sets it when he generates your key. If you think you have the wrong role, ask him.

To see what tools are available to you, type "what can you do?" in chat.

## When something doesn't work

| What you see | What it means | What to do |
| :--- | :--- | :--- |
| `unauthorized` or `401` | Your team key is wrong, expired, or you're not in the team list | Ping Collin |
| `Tool 'X' not available for your policy` | You're trying to use a tool your role doesn't have | That's expected; ask Collin if you need a role bump |
| `RATE_LIMITED` | Notion is being slow; the server already retried | Wait a few seconds and try again |
| Anything else | Genuine bug or server-side issue | Send Collin the full error text + what you typed |

## If you lose your team key

Ping Collin. He'll rotate it (the old one stops working immediately) and send you a new one. Then re-run step 2 above — Claude Code will prompt for the new key.

## Updating the plugin

When Collin pushes a new version, run:

```
/plugin update coresynq-team@luke-plugins
```

Your team key carries over — you don't have to re-enter it.

## Uninstalling

```
/plugin uninstall coresynq-team@luke-plugins
```

This removes the plugin and its team key from your machine.
