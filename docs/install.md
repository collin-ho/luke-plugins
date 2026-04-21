# Install Guide

## Prerequisites

- Claude Code CLI installed (https://docs.claude.com/en/code)
- Notion MCP connector authenticated in Claude Code (Settings → MCP → claude.ai Notion)
- GitHub access to this private repo (SSH key, gh CLI auth, or `GITHUB_TOKEN` env var)

## Install

```
/plugin marketplace add collin-ho/luke-plugins
/plugin install luke-notion@luke-plugins
```

## Remove prior shadow copies

If the Mac previously had `~/.claude/skills/luke-*/` directories, delete them so the plugin version is canonical:

```bash
rm -rf ~/.claude/skills/luke-{add,tasks,edit,done,domain,meeting-review,meeting-commit}
```

## Update

When new versions ship:

```
/plugin marketplace update luke-plugins
/plugin install luke-notion@luke-plugins
```
