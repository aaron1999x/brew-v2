# Claude Code workflow (how the build prompts will be used)

Status: **draft** · 12 Nov 2026 · Finalised in Phase 6 alongside the build prompts.

---

## 1. Principles

1. **One main session per milestone, no "orchestra".** Building a milestone is sequential, dependent work (schema → API → UI → tests), which is exactly the case where a single session is cleaner. A main agent delegating to many specialists costs *more* tokens overall, not fewer: each subagent is a separate Claude instance with its own context.
2. **Subagents only where they protect the main context:** noisy output (test and build logs) and a fresh, independent review. Two custom subagents, not ten.
3. **No agent teams.** They're experimental, off by default, and use far more tokens than a normal session.
4. **Context lives in the repo, not in the prompt.** Planning docs are copied into `docs/`. `CLAUDE.md` stays short and points at them. Each milestone prompt names the docs it needs instead of pasting them.
5. **Plan before code, every milestone.** Plan mode (Shift+Tab) or `/model opusplan`; Aaron approves the plan before any file changes.
6. **Each milestone ends with a handoff note** (`docs/progress.md`) so the next fresh session knows where things stand without re-reading the whole codebase.

---

## 2. Repo layout for context

```
/
├── CLAUDE.md                  ≤ ~150 lines: stack, commands, rules, pointers to docs/
├── .claude/
│   └── agents/
│       ├── test-runner.md     runs build/tests, returns only failures
│       └── reviewer.md        read-only review against acceptance criteria + a11y
└── docs/
    ├── product.md             Phase 0 + Phase 1 decisions (condensed)
    ├── ia-and-flows.md        Phase 2 sitemap and flows
    ├── design-tokens.css      Phase 3 tokens
    ├── design-system.md       Phase 3 components and a11y rules
    ├── schema.sql             Phase 4 database schema + RLS
    ├── architecture.md        Phase 4 system design
    ├── roadmap.md             Phase 5 milestones + acceptance criteria
    └── progress.md            Updated at the end of every milestone
```

---

## 3. Routine per milestone

| Step | What you do | Model |
|---|---|---|
| 1 | Start a fresh session (or `/clear`) | — |
| 2 | `/model opusplan` | Opus plans, Sonnet builds |
| 3 | Paste the milestone prompt; it starts in plan mode | |
| 4 | Read the plan. Push back or approve | |
| 5 | Claude builds in stages, committing after each stage | Sonnet |
| 6 | `test-runner` runs typecheck, lint, tests and build; only failures come back | Haiku |
| 7 | `reviewer` checks the diff against the milestone's acceptance criteria and WCAG rules | Sonnet |
| 8 | You check the hand-testable criteria on your phone | — |
| 9 | Claude updates `docs/progress.md`; you merge | — |
| 10 | `/clear` before the next milestone | — |

Full Opus (`/model opus`) only for the milestones flagged in the roadmap: database schema + row-level security, and offline sync.

---

## 4. Draft subagent files

### `.claude/agents/test-runner.md`

```markdown
---
name: test-runner
description: Use after any code change to run the project's checks (typecheck, lint, unit tests, build). Returns only failures with file paths and the smallest relevant error excerpt. Never edits files.
tools: Bash, Read, Grep, Glob
model: haiku
---

You run checks and report results. You never change files.

1. Run, in order: `npm run typecheck`, `npm run lint`, `npm run test -- --run`, `npm run build`.
2. Stop at the first failing command only if later commands depend on it; otherwise run all of them.
3. Report in this format and nothing else:

PASS: <list of commands that passed>
FAIL: <command>
- <file>:<line> — <one-line error>
- (max 15 lines per command; summarise the rest as "+N more")

If everything passes, reply with a single line: ALL CHECKS PASSED.
```

### `.claude/agents/reviewer.md`

```markdown
---
name: reviewer
description: Use at the end of a milestone, before merging, for an independent read-only review of the changes against the milestone's acceptance criteria, the project rules in CLAUDE.md, and WCAG 2.2 AA. Never edits files.
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a strict, independent reviewer. You did not write this code. You never change files.

Inputs you will be given: the milestone name and its acceptance criteria. Use `git diff main...HEAD` to see the changes.

Check, in this order:
1. Each acceptance criterion: met / not met / can't verify from code (say what a human should test).
2. Security and privacy: row-level security on every table touched; no private data reachable by other users or logged-out visitors; no secrets in client code.
3. Accessibility (WCAG 2.2 AA): labels, focus order and visible focus, target size ≥ 24×24 px, colour contrast via design tokens, live regions for timers and toasts, reduced motion.
4. Project rules in CLAUDE.md (tokens only, no hard-coded colours or units, strict TypeScript).
5. Missing tests for new logic.

Reply with:
BLOCKERS: <numbered list, or "none">
SHOULD FIX: <numbered list, or "none">
HUMAN TESTS: <short checklist for the developer's phone>
Keep the whole reply under 60 lines.
```

---

## 5. Token habits

- Keep `CLAUDE.md` short; it's loaded on every turn.
- `/clear` between milestones; `/compact` only when continuing the same milestone.
- Point at file paths; don't paste files or long logs.
- Ask for a plan before any change touching more than two or three files.
- Planning chats in Claude.ai share the same Pro usage limit as Claude Code: avoid heavy planning and heavy building on the same day.

## Sources
- Subagents (Claude Code docs): https://code.claude.com/docs/en/sub-agents
- How and when to use subagents (Claude blog): https://claude.com/blog/how-and-when-to-use-subagents-in-claude-code
- Manage costs (Claude Code docs): https://code.claude.com/docs/en/costs.md
- Models, usage and limits in Claude Code (Help Center): https://support.claude.com/en/articles/14552983
