---
name: luke-meeting-review
description: Review a Notion meeting page and produce a curated review draft. ALWAYS use this skill when the user wants to process a meeting, extract tasks from a meeting, or "review" a meeting. Never skip Phase 1 triage. Never silently filter user-candidate tasks.
allowed-tools: Bash, Read, Write, Edit, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Notion__notion-search, mcp__claude_ai_Notion__notion-create-pages, mcp__claude_ai_Notion__notion-update-data-source, mcp__claude_ai_Notion__notion-update-page, mcp__claude_ai_Notion__notion-get-users, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool
---

# Meeting Review Skill

Conversational review of a Notion meeting, producing a structured markdown draft ready for push to Notion via `/luke-meeting-commit`.

## Personality

Treat the user as the curator. AI task extraction is low-value (0/10 on ground truth) — the user drives what becomes a task. Your job is categorization, routing, and surfacing commitments faithfully, then offering a cross-check safety net.

Never silently filter user-candidate tasks. Show them, let the user decide.

## Review Status Lifecycle

Every row in the Meetings DB is in exactly one of three canonical states:

| State | Meaning | Set by |
|---|---|---|
| `Review Status = null` (blank) | Default state for a newly-ingested meeting. Has not been reviewed. | Notion ingest. |
| `Review Status = "Reviewed"` | Full review completed, tasks committed. Title and other properties populated. | `luke-meeting-commit` (Step 7). |
| `Review Status = "Skipped"` | User confirmed not worth reviewing. Title was renamed to a human-readable value *in the same write* as the status change. | `luke-meeting-review` Step 4 inline skip prompt. |

The title-rename on `Skipped` is mandatory: no row may land with `Title = "‣"` or blank. See Step 4 below for the title-source rule.

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
- A named hint (`"Karen 1:1 yesterday"`, `"team vs enterprise"`, `"latest Coresynq billing"`)
- Nothing at all (default: present all unreviewed)
- A structured hint (e.g. "recent meetings", "to-review", "Coresynq meetings")

**Resolution strategy:**

- **Meetings DB ID:** `9d019a9f-235f-4ecc-af82-8695a99859da`
- **Meetings data source:** `collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c`

**If UUID or URL** → normalize to a 32-char hex or dashed UUID inline (strip `https://www.notion.so/...` prefix, extract the ID from the path). Proceed directly to Step 1 with the resolved ID.

**Otherwise**, always start with the null-status dump via the `ntn` CLI (paginates natively):

```bash
ntn datasources query db2e5ca6-92b7-4e39-ab23-f4c496d2636c \
  --filter '{"property":"Review Status","select":{"is_empty":true}}' --limit 100 --json
```

Returns all null-status rows with their full page properties (Title, Date, Domain, created_time, etc.). This IS the candidate list — no second call needed for the default "review my meetings" case. Use `ntn` here (not `notion-query-database-view`, which only runs a view's pre-configured filters and takes no ad-hoc filter); page with `--start-cursor` if there are >100.

**If the user provided a named hint** (e.g. "William 1:1", "Karen yesterday", "team vs enterprise"):

1. Fuzzy-match the hint against the `Title` values in the dump result. If one row unambiguously matches, auto-pick and announce.
2. If zero Title matches (hint refers to block content, page has a timestamp title only), fall back to `notion-search`:
   ```
   mcp__claude_ai_Notion__notion-search({
     query: "<hint>",
     query_type: "internal",
     data_source_url: "collection://db2e5ca6-92b7-4e39-ab23-f4c496d2636c",
     page_size: 10,
     max_highlight_length: 200,
     filters: {}
   })
   ```
   `notion-search` in ai_search mode indexes block content. Use its `highlight` field to confirm a content match before auto-picking. Only cross-reference matches back against the null-status dump result — a hit on a `Reviewed` or `Skipped` row is not a candidate.
3. If multiple candidates survive (Title match ambiguous, or search returned several null-status hits), present the matching shortlist with any highlights and ask the user to pick.

**Candidate presentation** (no hint, or hint with multiple matches): sort by date descending (newest first, using `date:Date:start` when set, else `created_time`). For each row, display:

- If `Title` is a meaningful string (not `"‣"`, empty, or a bare ISO timestamp like `"2026-04-21T17:15:00.000-04:00"`), show: `<Title>` · `<Date>` · `<page_id_short>`.
- Otherwise show `(no content yet — created <created_time>)` · `<page_id_short>`. Timestamp-titled rows may still contain block content worth reviewing; don't drop them silently.

Present as a numbered list. Ask the user to pick by number, ID, or refined hint.

**Additional structured filters:** for "Reviewed meetings" / "Skipped meetings" / "Coresynq meetings" / etc., extend the dump filter accordingly — e.g. `{"property": "Review Status", "select": {"equals": "Reviewed"}}` or compound with `{"and": [{"property": "Review Status", "select": {"is_empty": true}}, {"property": "Domain", "select": {"equals": "Coresynq"}}]}`.

Once a meeting ID is confirmed, proceed to Step 1.

### Step 0.5: Cortex Inbox Triage

Before reviewing the meeting, check for untriaged tasks in the Cortex Inbox (the renamed cortex Tasks DB — collin's private quick-add inbox).

**Cortex Inbox data source:** `collection://b0d00fd8-eebb-434d-84c1-a652260fbe79`

Post-refactor, Cortex Inbox holds tasks that didn't get an Initiative at creation time (untriaged intake). "Triage" means **moving** these tasks into their proper per-business Tasks DB and assigning the right Initiative.

Query via the `ntn` CLI:

```bash
ntn datasources query b0d00fd8-eebb-434d-84c1-a652260fbe79 \
  --filter '{"or":[{"property":"Status","select":{"equals":"Backlog"}},{"property":"Status","select":{"equals":"To Do"}}]}' --limit 100 --json
```

(All Cortex Inbox rows are untriaged by definition — they're in the inbox BECAUSE they have no initiative. Filter is just by Status to focus on open ones.)

When the query returns results, present them immediately as a numbered list. Do NOT ask whether to triage first — present, then ask which domain + initiative each goes to.

> "Found N untriaged Cortex Inbox tasks. For each, which Domain + Initiative?"
>
> 1. Task title — Status · Created date
> 2. ...

For each item the user assigns a Domain + Initiative:

1. **Create a new task** in the matching domain's Tasks DB (Cogent / Coresynq / Rezzy / Personal — data source IDs in `/luke-add`). Copy over Title, Status, Priority, Due Date, Notes, Source Spec, Assignee, Legacy Task ID. Set Initiative to the resolved page URL.
2. **Archive the Cortex Inbox row** via `mcp__claude_ai_Notion__notion-update-page` with `properties: {"Status": "Archived"}` and content_updates: `[{op: "trash"}]` (or set `Status: Archived` for soft-archive without trashing).

If no untriaged items exist, skip silently and proceed to Step 1.

### Step 0.7: Mode selection — Browser Dashboard vs. Chat

**Default mode is the Browser Dashboard** when the candidate list contains 3 or more meetings (a "batched review"). Single-meeting reviews may still run in chat for speed.

The browser dashboard exists because Phase 1 → Phase 2 → Phase 2.5 chat walkthroughs are slow to read and harder to correct — Collin called it "so much better than text" the first time we built one (2026-05-13 session) and asked that it become the default.

**Decision rules:**

| Situation | Mode |
|---|---|
| Batch of ≥3 unreviewed meetings | **Browser** (default) |
| User says "do this in chat" / "walk me through" / single ad-hoc meeting | Chat |
| Browser MCP unavailable (no `mcp__claude-in-chrome__*` tools loaded) | Chat (announce the fallback) |
| User says "use the dashboard" / "browser" / "the way we did last time" | **Browser** |

Once chosen, proceed to the corresponding branch. **Browser mode replaces Steps 5–10** with the flow in the `## Browser Dashboard Mode` section at the bottom of this skill. Steps 1–4 (bootstrap, carry-forward, fetch content, empty-meeting check) still run for each meeting before the dashboard renders.

### Step 1: Bootstrap context

Fetch the meeting page via MCP:

```
mcp__claude_ai_Notion__notion-fetch on the resolved meeting ID
```

This provides the full page properties and content needed for triage.

**Local operations** (still required):
- **Initiative resolution:** scope `notion-search` to the meeting's domain's Initiatives data source (resolved from `frontmatter.triage.domain` or the meeting's `Domain` field). Per-domain Initiatives data-source IDs are in the Notion Brain (`${CLAUDE_PLUGIN_ROOT}/README.md` §2). Do NOT use the old cortex Initiatives DB (`28a0a1b7`) — it's frozen/404. Cache results in-session.
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

### Step 4: Empty-meeting inline prompt (block-content signal only)

After Step 3's fetch, evaluate emptiness from the fetched block content ONLY. No page-property cross-reference, no pre-Step-3 detection.

**Empty conditions:**
- **Shape A (native `<meeting-notes>`):** the block is present but contains no `<summary>` content AND no `<transcript>` content (or shows `<empty-block/>` with no substantive siblings).
- **Shape B (recovered):** no `AI Summary (recovered)` heading AND no `Transcript (recovered)` heading.
- **No shape detectable:** no `<meeting-notes>` block, no recovery marker headings, visible body content empty.

**Hard block:** if page properties include a non-null `recovered_from_url`, do NOT offer skip — surface the source URL to the user and let them decide.

**If empty (and not recovered):** prompt inline:

> "This meeting looks empty — no transcript, no summary, no notes. Skip or push through with a manual review?"

Wait for explicit user confirmation. NEVER auto-skip.

**On "skip":**

1. **Extract the block-level AI title from the Step 3 fetched content:**
   - **Shape A:** the first bold-wrapped heading-line inside `<meeting-notes>` (e.g. `**Claude Teams vs Enterprise Decision Meeting** <mention-date start="2026-04-21"/>`). Strip `<mention-date/>` spans and markdown emphasis markers (`**`). Trim.
   - **Shape B:** the value on the `## AI Title: <title>` heading_2 block.
   - Apply sentinel validation: reject if the extracted string is empty, whitespace-only, longer than 200 chars, or equals `"‣"`.
2. **If no usable block-level title,** prompt:
   > "No AI title on this one — what should we call it?"
   - Apply the same sentinel validation on the user's response.
   - Accept "skip", "no", "forget it", "nevermind", "cancel" (case-insensitive) as "user aborted the skip" — exit cleanly without writing.
   - On invalid response (empty / too long / sentinel), re-prompt once. If the second response also fails, abort the skip cleanly.
3. **Atomic write:**
   ```
   mcp__claude_ai_Notion__notion-update-page({
     page_id: "<meeting_id>",
     command: "update_properties",
     properties: {
       "Title": "<validated_title>",
       "Review Status": "Skipped"
     },
     content_updates: []
   })
   ```
4. **Echo:**
   - If title came from block extraction: `Skipped. Renamed to "<validated_title>" (from block AI title). Status → Skipped. Edit via /luke-edit if you want a different title.`
   - If title came from user prompt: `Skipped. Renamed to "<validated_title>". Status → Skipped. Edit via /luke-edit if you want a different title.`
   - On clean abort: `No changes made. The meeting stays in its current state (Review Status: null). Come back when you have a title, or edit the meeting in Notion directly and re-run /luke-meeting-review.`

**On "push through":**
Proceed to Step 5 (Phase 1 triage) normally. The rest of the flow runs unchanged; content is just thin.

**If non-empty:** proceed directly to Step 5 without the inline prompt.

**Do NOT attempt to trash via MCP** — MCP has no `in_trash` support. If the user genuinely wants the meeting deleted, tell them to trash it from the Notion UI.

#### NEVER auto-skip

Historical incident: earlier in this project, bulk-trashing 4 rows without user confirmation destroyed content that had to be restored. The confirmation gate above is non-negotiable. No write happens without both (a) a valid title (block-extracted or user-supplied) and (b) explicit user confirmation of the skip.

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

**Initiative-conditional field prompts:** for each task the user commits to keeping, apply these conditional prompts before writing it to the draft:

- If the task's initiative name starts with `Coresynq – `: offer an Area value. First attempt auto-inference using the Coresynq keyword table documented in `/luke-add`'s "Domain-Specific Properties" section (e.g., `claim form` → Billing). If inference hits one or two Areas confidently, show them for user confirmation: *"Area: [Billing]? (y/edit/skip)"*. If inference is ambiguous or zero-hit, ask: *"Area? (pick from list, or skip)"* and offer the full Area list.
- If the task's initiative name starts with `Rezzy – ` OR `Rezzy External – `: ask: *"Client? (school name or skip)"*. No auto-inference — clients are usually named explicitly in the meeting if relevant.
- Otherwise (Cogent, Personal, Work, or any other domain): no field prompt.

**Source Spec capture:** during task extraction, if a transcript segment tied to a candidate task references a file path matching `/Users/.*\.md` or `docs/.*\.md` (or a similar spec-like path), surface inline:

> "Transcript references `<path>` — attach as `source_spec`? (y/n)"

Do NOT auto-attach. User confirmation is mandatory. If no spec path is cited in the transcript, the field stays absent.

These prompts are all optional — user always has a `skip` escape. Absent fields must stay absent in the draft (do not write empty strings or placeholder values).

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
- assignee: 1b1d872b-594c-81d5-8ae2-00027cffc129
- area: [Billing, Claims]
- client: Duke
- source_spec: /Users/collin-mbp-m5/workspace/docs/specs/2026-04-22-xyz.md
- source: review-conversation
- notes: |
    Multi-line notes here.
```

Rules:
- Plain `- key: value` only. No bold markdown (not `- **key:** value`).
- `initiative` is required. `priority`, `status`, and `notes` should always be set on a review-sourced task (the commit parser defaults to `P2` / `To Do` / empty, but meeting drafts should never rely on defaults). All other fields are optional — omit the line entirely if no value (do NOT write empty strings).
- `area` is a bracketed list (1–2 values). Valid only for Coresynq-domain tasks.
- `client` is a single value (school name). Valid only for Rezzy-domain tasks.
- `source_spec` is a file path. Set when the task derives from a spec doc referenced in the transcript.
- Valid statuses: `Backlog`, `To Do`, `In Progress`, `Pending Review`, `Blocked`, `Done`, `Archived`.
- Valid priorities: `P0`, `P1`, `P2`, `P3`.
- `source` is draft-internal provenance (`transcript-quote` / `review-conversation` / `ai-cross-ref`) — not a Notion property.

Leave `ready_for_commit: false`. User flips to `true` when they're ready to hand off to `luke-meeting-commit`.

### Step 10: Handoff

> "Draft saved to `<path>`. Review it if you want, or say 'push' to send to Notion now."

On user confirmation with an affirmative verb (`push`, `send`, `send it`, `yes push`, `go`, `go ahead`):

1. `Read` the draft markdown file.
2. Flip `ready_for_commit: false` → `ready_for_commit: true` in the YAML frontmatter via the `Write` tool (re-write the whole file with the one-line change).
3. Explicitly invoke `/luke-meeting-commit` — do not ask the user again.

Anything short of an affirmative verb ("yeah looks good", "cool", "thanks") leaves the draft at `ready_for_commit: false`. User can re-invoke `/luke-meeting-review` later or say "push" next time.

Manual YAML editing is NOT a documented user action. If the user wants to tweak the draft body/tasks before push, they open the file themselves; the skill never instructs them to edit YAML.

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

---

## Browser Dashboard Mode

The default flow for batched (3+) reviews. Replaces Steps 5–10 with an interactive HTML dashboard the user drives in Chrome while the agent polls for state and writes drafts as each meeting is approved.

The reference HTML template lives next to this skill at `assets/dashboard-template.html`. Read it, inject the meeting-specific data, and write the rendered output to `$CLAUDE_JOB_DIR/review.html` (or `~/.claude/luke/drafts/meeting-reviews/dashboard-<session>.html` if `$CLAUDE_JOB_DIR` is unset).

### B-0. Tab discovery & spawn — CRITICAL

The MCP can only see and script tabs that live in **its tab group**. If the user opens the file in a separate Chrome window, you cannot read or write its state.

**Always spawn the tab yourself via `mcp__claude-in-chrome__tabs_create_mcp`**, then `mcp__claude-in-chrome__navigate` to the `file://` URL. Confirm the URL on the returned tab is the dashboard, not `chrome-error://`. Common gotcha: the navigate tool may report `https://file:///...` even though it loaded — verify by calling `javascript_tool` to read `location.href` and `typeof window.SESSION` after navigation. If `window.SESSION === 'undefined'`, the page did not load.

Never instruct the user to "open the file" themselves. Send them the tab and tell them where to look.

### B-1. Build session payload

For each candidate meeting in the batch, run Steps 1–4 (bootstrap, carry-forward, fetch full content, empty-meeting handling). For non-skipped meetings, pre-compute a payload object:

```
{
  idx, id, notion_url,
  triage: { title, summary, date, type, complexity, duration, attendees_primary, attendees_mentioned, domain, initiative_primary, initiative_secondary },
  sections: [{ title, decisions: [{ text, work_bearing }], context: [string] }],
  tasks: [{ keep_status: 'green'|'yellow'|'red', title, initiative, priority, status, due, assignee, source, notes }],
  ai_summary_raw: string
}
```

Inject all N payloads into the dashboard at build time. Lazy-load is fine for very large batches but eager is simpler — render all and let the user move via the queue sidebar.

### B-2. Render dashboard

Layout (left → main → right):

- **Left queue sidebar:** numbered list of all meetings, progress bar (done / total), active highlight on current, ✓ on done, ⊘ on skipped. Click = jump to that meeting.
- **Main column:** sticky header (editable title + summary), Phase-1 triage card (collapsible), per-section cards (decisions with click-to-toggle WORK/INFO badges + key context, all `contenteditable`), task sweep (checkbox-to-keep, editable title/notes, + Add Task button), sticky bottom action bar (Skip · Send Note · ✓ Approve & Continue).
- **Right pane:** raw AI summary for cross-reference / audit.

Style: dark theme, monospace, Tailwind via CDN, color-coded confidence pills (🟢 / 🟡 / 🔴).

### B-3. Persistence (mandatory)

The dashboard MUST persist all user edits to `localStorage` under key `meeting_review_session_<job_or_session_id>` and rehydrate on load. Auto-save on every click and input event, plus a 5-second safety-net interval. Without this, a refresh wipes the user's work and they will be (justifiably) furious.

### B-4. State signals the agent polls

The dashboard exposes these globals; the agent reads them via `javascript_tool`:

| Global | Set by | Meaning |
|---|---|---|
| `window.__STATE` | Approve / Skip / Note buttons | `'approved'`, `'skipped'`, `'note'`, or unset |
| `window.__APPROVED_PAYLOAD` | Approve button | Captured payload with all edits applied |
| `window.__SKIP_TITLE` | Skip button | Title to write back to Notion (for `Skipped` status) |
| `window.__USER_NOTE` | Send Note button | Free-text message from user |
| `window.__JUMP_TO` | Queue sidebar click | Meeting idx the user wants to navigate to |
| `window.SESSION.meetings[i].status` | Auto on approve/skip | `'pending'`, `'in_progress'`, `'done'`, `'skipped'` |

### B-5. Polling loop

After every user-driven action (or every 30–60s when idle, per the harness's notification model), poll:

```
javascript_tool({
  tabId: <dashboard tab>,
  text: `JSON.stringify({
    state: window.__STATE,
    payload: window.__APPROVED_PAYLOAD,
    note: window.__USER_NOTE,
    skipTitle: window.__SKIP_TITLE,
    jumpTo: window.__JUMP_TO,
    currentIdx: window.SESSION?.currentIdx,
  })`
})
```

On `'approved'`: capture payload → write draft markdown to `~/.claude/luke/drafts/meeting-reviews/<meeting_id>.md` (same format as Step 9) → flip `ready_for_commit: true` → invoke `/luke-meeting-commit` → reset `window.__STATE = null` and `window.__APPROVED_PAYLOAD = null` via `javascript_tool` → advance dashboard to next meeting via `window.SESSION.currentIdx++`.

On `'skipped'`: do the inline-skip write to Notion (Step 4 logic with `Skipped` status + title rename) → reset state.

On `'note'`: read the note in chat, respond, clear `window.__USER_NOTE`.

### B-6. Fallback / failure modes

- **Tab gets a `chrome-error://` URL:** the file:// navigate failed. Re-spawn a tab and re-navigate; if it fails twice, fall back to chat mode and tell the user why.
- **User opens the file in a non-MCP-group tab:** you cannot see it. Politely explain and re-spawn in the MCP group, restoring state from `localStorage` if the user already worked in it on the same machine (same localStorage key).
- **Browser MCP not loaded:** announce the fallback to chat mode and proceed with Steps 5–10 instead.

### B-7. Saving feedback / history

After the batch finishes, if anything noteworthy emerged about how the dashboard behaved (perf, layout regressions, missing affordances), capture it as a `feedback_browser-review-ui` memory update so subsequent sessions improve.
