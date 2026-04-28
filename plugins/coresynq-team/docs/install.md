# Install

Once Collin has sent you your `TEAM_KEY`:

1. **Install Claude Code** if you haven't.
2. **Add the marketplace** (one-time):
   ```
   /plugin marketplace add collin-ho/luke-plugins
   ```
3. **Install this plugin:**
   ```
   /plugin install coresynq-team@luke-plugins
   ```
4. **Paste your TEAM_KEY** when prompted.

## Verify

Type into chat: **"who am I?"**

Claude should call `whoami` and return your name + email. If it does, you're good.

## Try it

- "Add a task to fix the unmatched-claims script for coresynq"
- "What's on my plate?"
- "Mark CTX-1234 as done"

## If something doesn't work

- 401 errors → your `TEAM_KEY` is wrong or you're not in `auth.json`. Ping Collin.
- "tool not available" → you're using a tool your role doesn't have. Ask in chat what's available.
- Anything else → ping Collin with the error message and the command you tried.
