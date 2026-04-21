# luke-plugins

Private Claude Code plugin marketplace hosting Collin's personal productivity skills.

## Install

On any Mac with Claude Code:

1. Ensure the Notion MCP connector is authenticated in Claude Code (Settings → MCP → claude.ai Notion).
2. Add this marketplace:
   ```
   /plugin marketplace add collin-ho/luke-plugins
   ```
3. Install the plugin:
   ```
   /plugin install luke-notion@luke-plugins
   ```

On first install (v0.2.0+), Claude Code will prompt for a `NOTION_TOKEN` — paste your integration token (starts with `ntn_`). If you skip the prompt, the MCP server falls back to reading `NOTION_TOKEN` from your shell environment.

**Before the token works, grant the integration access to the canonical DBs** via each DB's ••• → Connections → Add. Without this step, `/luke-dump` returns 403 errors.

If your Mac already has local copies of the `luke-*` skills in `~/.claude/skills/`, delete those after install so the plugin version is canonical:

```bash
rm -rf ~/.claude/skills/luke-{add,tasks,edit,done,domain,meeting-review,meeting-commit}
```

## Plugins in this marketplace

- **luke-notion** — 7 Notion-native skills for tasks, meetings, and taxonomy. See `plugins/luke-notion/README.md`.

## Update

When you push changes here, other machines pull them with:

```
/plugin marketplace update luke-plugins
/plugin install luke-notion@luke-plugins
```

Auto-update is off by default for private marketplaces — toggle in `/plugin → Marketplaces` tab if you want it on.

## Versioning

- `0.x.y` while stabilizing. Bump `x` for meaningful changes, `y` for small fixes.
- Promote to `1.0.0` after a week of clean use on ≥2 machines.
- Tag every release: `git tag v0.1.1 && git push --tags`.

## Contributing (solo workflow)

1. Edit skill(s) in `plugins/luke-notion/skills/`.
2. Bump `plugins/luke-notion/.claude-plugin/plugin.json` `version`.
3. Commit with a one-line changelog: `v0.1.1 — <summary>`.
4. Tag and push.
