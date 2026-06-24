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

4. Authenticate the `ntn` CLI (used for paginated queries past the hosted MCP's 100-row cap): `ntn login` (or set `NOTION_API_TOKEN`); verify with `ntn doctor`. No per-DB sharing needed — `ntn login` is a workspace-scoped user token.

All Notion anchors, routing, and conventions live in the plugin's **Brain** (`plugins/luke-notion/README.md`) — the single source of truth.

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
