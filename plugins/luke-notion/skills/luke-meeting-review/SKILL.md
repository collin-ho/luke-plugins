---
name: luke-meeting-review
description: Review a Notion meeting page and produce a curated review draft. ALWAYS use this skill when the user wants to process a meeting, extract tasks from a meeting, or "review" a meeting. Never skip Phase 1 triage. Never silently filter user-candidate tasks.
allowed-tools: Bash, Read, Write, Edit, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-query-database-view, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-update-data-source, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-get-users
---

# Meeting Review Skill

Conversational review of a Notion meeting, producing a structured markdown draft ready for push to Notion via `/luke-meeting-commit`.

## Personality

Treat the user as the curator. AI task extraction is low-value (0/10 on ground truth) — the user drives what becomes a task. Your job is categorization, routing, and surfacing commitments faithfully, then offering a cross-check safety net.

Never silently filter user-candidate tasks. Show them, let the user decide.

## Core Philosophy

```
HIGH CONFIDENCE, AUTOMATE    → Meeting categorization + routing
MEDIUM CONFIDENCE, SURFACE  → Decisions, key context, commitments
LOW CONFIDENCE, ASSIST      → Task suggestions (user curates)
```

Commitments (verbatim quotes from transcript) > speculative AI tasks.

## Execution

### Step 0: Resolve the meeting

The user may invoke this skill with:
- A Notion page ID (dashed UUID or 32-char hex)
- A Notion meeting URL
- A natural-language phrase (`"Karen 1:1 yesterday"`, `"latest Coresynq billing"`, `"today's Tim 1:1"`)
- Nothing at all
- A structured filter (e.g. "pending meetings", "Cogent domain meetings")

**Resolution strategy (MCP-first):**

- **Meetings DB ID:** `9d019a9f-235f-4ecc-af82-8695a99859da`
- **Meetings data source:** `collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c`

**If UUID or URL** → normalize to a 32-char hex or dashed UUID inline (strip `https://www.notion.so/...` prefix, extract the ID from the path). Proceed directly to Step 1 with the resolved ID.

**If natural language** → use `mcp__claude_ai_Notion__notion-search` scoped to the Meetings data source (`collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c`) with the user's phrase as the query. Parse the returned candidates.

**If structured filter** (e.g. "pending meetings", "unreviewed", "to-review", "needs review", or nothing at all with an implicit recency-based filter) — the skill must treat the three legacy "needs review" states as equivalent:

```
Review Status IS null OR Review Status = "Unreviewed" OR Review Status = "Pending"
```

All three mean "has not been reviewed yet." `null` is the default state for newly-ingested meetings going forward. `Unreviewed` and `Pending` are legacy values left in the DB from earlier migrations — the skill no longer writes either (Rule 1 below) but must still surface them until they naturally drain.

**Primary path:** attempt the filter directly in `mcp__claude_ai_Notion__notion-query-database-view` on the Meetings DB (`9d019a9f-235f-4ecc-af82-8695a99859da`). If the DSL supports the multi-value OR, use it.

**Fallback path (if the DSL silently drops complex filters — see `feedback_mcp_view_filter_limits.md`):** (a) query for `Review Status IS null` via `notion-query-database-view`; (b) query `notion-search` scoped to the Meetings data source (`collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c`) with a broad recency filter; (c) filter the union in-memory for `Review Status IN ("Unreviewed", "Pending", null)`; (d) de-duplicate by page ID.

Queries for already-reviewed or already-skipped meetings continue to use exact values (`Review Status = "Reviewed"` or `= "Skipped"`) — no OR required.

**If nothing** → query recent meetings via `mcp__claude_ai_Notion__notion-search` scoped to the Meetings data source with an empty or broad query (limit to recent results).

**Candidate presentation:** when multiple candidates are returned, present them to the user:

- Display each with `ai_title ?? title ?? "(untitled)"` · `date` · `domain`
- If the user's query obviously narrows to exactly one candidate, auto-pick and announce
- Otherwise show a numbered shortlist, ask user to pick (by number, by keyword, or by pasting an ID)
- User may also refine the query → re-run the resolution

Once a meeting ID is confirmed, proceed to Step 1.

### Step 0.5: cortex Triage

Before reviewing the meeting, check for untriaged tasks in the canonical Tasks DB.

**Canonical Tasks DB ID:** `4de35153-f31d-4427-bc5a-1c3b1c08648e`
**Data source:** `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79`

All tasks live in this single DB. "Triage" means assigning an Initiative to tasks that don't have one yet.

Query via `mcp__claude_ai_Notion__notion-query-database-view` for items where:
- **Initiative** relation is empty (no linked initiative)
- **Status** is `Backlog` or `To Do`

If results are returned, present them to the user as a numbered list:

> "Found N untriaged tasks (no Initiative assigned) before we start the review:"
>
> 1. Task title — Status · Created date
> 2. ...
>
> "For each: which Initiative should this belong to? (or skip to defer)"

For each item the user assigns an Initiative:
1. Update the existing task via `mcp__claude_ai_Notion__notion-update-page` to set the **Initiative** relation to the user's chosen initiative.
2. That's it — no creation or archiving needed. The task stays in place, now properly categorized.

If no untriaged items exist, skip silently and proceed to Step 1.

### Step 1: Bootstrap context

Fetch the meeting page via MCP:

```
mcp__claude_ai_Notion__notion-fetch on the resolved meeting ID
```

This provides the full page properties and content needed for triage.

**Local operations** (still required):
- **Initiative resolution:** use `notion-search` scoped to `collection://28a0a1b7-d639-4e34-898f-e19415823dec` when you need to resolve an Initiative by name. Cache results in-session.
- **Draft check:** look for an existing draft in `~/.claude/luke/drafts/meeting-reviews/` matching this meeting ID (resume vs. new). This is a user-global location — independent of Claude Code's current working directory.
- **Carry-forward scan:** check for unresolved items from prior reviews of this meeting.

**Before Step 2, check page properties for `recovered_from_url`.** If set, this row was restored from a Phase 7b migration source — surface the source URL in the Phase 1 triage output for user context, and NEVER propose trash on this row (it has already been recovered; the "empty" appearance is a content-shape difference, not missing content).

### Step 2: Handle carry-forward

If `carry_forward_items` has entries, surface them to the user:

> "N unresolved items from prior reviews: [list]. Address any during this review, or leave for next time?"

### Step 3: Fetch full meeting content (MANDATORY — never skip)

Use MCP `notion-fetch` with `include_transcript: true` on the meeting ID. The result will be in one of two shapes:

**Shape A — native Notion-AI meeting-notes:**
- Outer `<meeting-notes>` wrapper
- Inner `<summary>` section with `### Action Items` / `### Key Decisions` / topical subsections
- Inner `<transcript>` section with raw speaker turns

**Shape B — recovered meeting (post Phase 7b migration):**
- `## AI Title: <title>` heading_2
- `## AI Summary (recovered)` heading_2 followed by H3 subsections + bullets
- `## Transcript (recovered)` heading_2 followed by paragraph blocks

Both shapes carry the same semantic content. Parse whichever you encounter; if neither is present, the meeting has no AI-captured content.

Preserve the raw summary verbatim for the audit section at the bottom of the draft.

**Overflow handling:** if the MCP response exceeds its token limit, the tool saves the full output to a file path printed in the error message. Read that file directly in sequential chunks until you've covered the entire content. When you persist it for later use, save to `~/.claude/luke/recovery/source-<meeting_id>.txt` (`mkdir -p` the directory if needed).

### Step 4: Empty meeting fast-path (MCP-grounded only)

After Step 3 has produced a content result, check these conditions:

1. **Shape A empty:** the `<meeting-notes>` block is present but contains no `<summary>` content AND no `<transcript>` content (or shows an explicit `<empty-block/>` marker with no substantive siblings).
2. **Shape B empty:** no `AI Summary (recovered)` heading AND no `Transcript (recovered)` heading present.
3. **Neither shape detectable:** the MCP-fetched page has no meeting-notes block at all AND no recovery marker headings AND the visible body content is empty.

The signal MUST come from MCP content. Do NOT cross-reference SDK block counts or diagnostics — they are not part of the emptiness decision.

**Hard block:** if the page properties include a non-null `recovered_from_url`, do NOT propose skipping — surface the source URL to the user and let them decide.

Only when conditions hold AND the row is not a recovered one, surface to the user:

> "This meeting looks empty — no transcript, no summary, no notes. Mark Review Status = Skipped?"

Wait for explicit user confirmation. On confirmation, set `Review Status: "Skipped"` via `notion-update-page` with `update_properties`. The row stays in the DB (easy to revisit) but is flagged as not-worth-reviewing.

**Do NOT attempt to trash via MCP** — MCP has no `in_trash` support. If the user genuinely wants the meeting deleted, tell them to trash it from the Notion UI.

NEVER auto-skip. (Historical: earlier in this project, bulk-trashing 4 rows without checking destroyed content that had to be restored.)

### Step 5: Phase 1 — Triage

Classify the meeting and propose routing. Present as a single compact block:

```
═══════════════════════════════════════════════════════════════════
  PHASE 1 — MEETING TRIAGE
═══════════════════════════════════════════════════════════════════
```

**Proposed title** → `<slug>`

**Summary** (blockquote, 1-2 lines)

Single 2-column table with:
- Date · Type · Complexity · Duration · Sectioned output flag
- Primary attendees (inferred from TRANSCRIPT CONTENT, not page properties or AI-summary attendees attribute)
- Mentioned (not attending)
- Domain (🟢/🟡/🔴)
- Initiative primary (🟢/🟡/🔴)
- Initiative secondary (if any)

Confidence markers:
- 🟢 = high confidence, skill is sure
- 🟡 = low confidence / your-call, ambiguous from context
- 🔴 = skill disagrees with AI-summary or metadata suggestion

Wait for user confirmation before Phase 2.

**When user names attendees:** STOP guessing. Use their call.

**When user proposes a new Initiative:** invoke `/luke-domain` to create it in the Initiatives DB, then resume triage. No local index to refresh — initiatives resolve live via `notion-search`.

### Step 6: Pick flow variant

- **Variant A (section-first):** team-planning, multi-stakeholder, strategy, governance
- **Variant B (task-first):** 1:1, catch-up, thought-session, peer-sync (when no reporting line + low commitment density)

Classifier signals for Variant B (any 2):
- Meeting type in `{1:1, catch-up, thought-session, peer-sync}`
- No reporting line between primary attendees
- <3 Collin-candidate tasks identified
- User opening comment contains "high level", "catch up", "nothing major"

User can override: "do this task-first" / "show me sections first".

### Step 7a (Variant A): Phase 2 Content — Progressive Sections

If `sectioned_output: true`:
- Chunk by topic (default 3 sections per chunk; user can override `--chunk-size=N`)
- Per section: **Decisions** (with `work_bearing` flag per user input) + **Key Context** + inline natural-language prompt specific to content
- NO rigid `(c)ontinue/(s)kip/(d)one` menu — inline prompts emerge from content

If `sectioned_output: false`:
- Flat single-block output: Decisions / Key Context / Commitments

### Step 7b (Variant B): Task Sweep first, sections on-demand

Present Phase 2.5 immediately. Section content available on-demand if user asks.

### Step 8: Phase 2.5 — Task Sweep (required final step, both variants)

**Framing:** this is a cross-check / safety net, NOT a fresh AI extraction pass.

Primary task sources:
1. **User commitments from transcript** (verbatim quotes)
2. **Tasks from review conversation** (user-decided during review)

AI's role: cross-reference against transcript + AI summary + commitments for anything the user might have missed. NEVER silently filter.

**Shape-specific parsing:**
- **Shape A (native):** action items are bullets under `### Action Items` inside the `<summary>` tag; transcript grounding uses the raw text inside the `<transcript>` tag.
- **Shape B (recovered):** action items are bullets under `### Action Items` H3 nested inside the `## AI Summary (recovered)` heading_2 region; transcript grounding uses the sequential paragraph blocks under `## Transcript (recovered)`. Checkbox prefixes (`[ ]`) are preserved in the bullet text.

Output format:
```
🟢 LIKELY KEEP
  1. <task> — <reasoning + source>

🟡 WORTH DISCUSSING
  2. <task> — <reasoning + clarifying question>

🔴 PROBABLY NOT (but flagging so you see)
  3. <task> — <reasoning why skill thinks it's not needed>
```

Then the **open-prompt escape hatch:**

> "Anything else you want tracked that I missed?"

**Task sweep disambiguation:** when the user signals that items are related or similar, confirm grouping intent:

> "These are all [initiative] work. Separate tasks linked to the same initiative, or one umbrella task with details in notes?"

### Step 9: Write the draft markdown

Once all content is curated, assemble the full draft markdown inline and use the `Write` tool to save it to `~/.claude/luke/drafts/meeting-reviews/<meeting_id>.md`. This is a user-global location — always the same path regardless of the Claude Code session's current working directory. If the directory doesn't yet exist, run `mkdir -p ~/.claude/luke/drafts/meeting-reviews` first (Bash tool).

The frontmatter must be valid YAML between `---` markers. Required fields:

```yaml
meeting_id: "<dashed-uuid>"
notion_url: "https://www.notion.so/<meeting_id_no_dashes>"
reviewed_at: "<ISO datetime>"
flow_variant: "section-first" | "task-first"
sectioned_output: true | false
ready_for_commit: false
committed_at: null
summary: "<one-line summary>"
triage:
  title: "<proposed title>"
  date: "<YYYY-MM-DD or ISO datetime>"
  domain: "<Cogent|Personal|Rezzy|Coresynq|Work>"
  initiatives:
    primary: "<initiative name>"
    secondary: null
  attendees:
    primary: ["<name>", ...]
    mentioned: ["<name>", ...]
  type: "<meeting type>"
  complexity: "conversational" | "mixed" | "technical"
  duration: "short" | "medium" | "long"
carry_forward_items: []
notion_writes:
  tasks: []
  meeting_page_updated: false
  review_log_appended: false
```

Body structure:
- `## Sections` (skip if `sectioned_output: false`) with per-section `### § N · Topic` + Decisions + Key Context
- `## Commitments captured (external)`
- `## Tasks (curated — 🟢 keep)` with per-task `### N. Title` + structured fields
- `## Open / Pending` with inline JSON-ish objects
- `## AI Summary (raw, preserved for audit)` — source depends on shape:
  - **Shape A:** paste the verbatim content of the `<summary>` tag.
  - **Shape B:** paste the verbatim text content of the blocks under `## AI Summary (recovered)` (the H3 subsections + bulleted items), preserving the markdown heading/bullet structure.

**Task field format** — the commit script parser expects this exact structure:

```
### 1. Task Title Here
- initiative: Cogent – ClickUp
- priority: P1
- status: To Do
- due: 2026-04-25
- source: review-conversation
- notes: |
    Multi-line notes here.
```

Rules:
- Plain `- key: value` only. No bold markdown (not `- **key:** value`).
- Assignee field is optional.
- Valid statuses: `Backlog`, `To Do`, `In Progress`, `Pending Review`, `Blocked`, `Done`, `Archived`.
- Valid priorities: `P0`, `P1`, `P2`, `P3`.

Leave `ready_for_commit: false`. User flips to `true` when they're ready to hand off to `luke-meeting-commit`.

### Step 10: Handoff

> "Draft saved to `<path>`. Review the frontmatter/body if you want to tweak anything. When ready, flip `ready_for_commit: true` and invoke `/luke-meeting-commit` to push to Notion."

## Required Output Sections (cannot drop)

1. Commitments (external to Collin)
2. Collin commitments from transcript (primary task source)
3. Tasks discovered during review conversation
4. Open / Pending items

## Handling User Uncertainty

When user says "I could be tripping" or "not sure":
1. Search transcript for direct quotes
2. Search AI summary for specific claims
3. Present evidence: "Transcript says X, AI claims Y, clearest interpretation is Z — does that match?"
4. Only defer if genuinely ambiguous

**Default = dig, not defer.**

## AI Summary Correction Pattern

The AI-generated summary gets details wrong (observed: wrong structural claims like "based on 4 pillars", wrong attribution). When surfacing a specific claim from AI summary, flag it as AI-derived. Prefer transcript context over paraphrase.

## Divider Format

- Opening: `═══` heavy box with phase name
- Closing: `───` light rule with inline action prompt
- Never stack `---` markdown rule + `═══` together

## See Also

- Committing the draft to Notion: `/luke-meeting-commit`
- Managing initiatives: `/luke-domain`
