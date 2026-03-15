# Agent Session Lifecycle Protocol — v0.1.0

> This document defines the outer loop — the session-level lifecycle that wraps
> the inner work loop (Understand → Plan → Patch → Validate).

---

## Pre-Session

Execute these steps at the start of every session, before any task work begins.

### 1. Load Context (via Registry)

Follow the loading protocol in `registry.yaml`:
1. Load all Tier 1 (global) files
2. Load all Tier 2 (project) files
3. Defer Tier 3 (topic) loading until triggers match

### 2. Orient on Recent Work

- Read `../.agents/state/session-log.md` — focus on the most recent entry
- Identify: last task completed, open threads, unresolved issues, pending decisions

### 3. Resumption Check

Ask yourself:
- **Am I continuing something?** Check for in-progress work, open TODOs, or
  explicit "next steps" from the prior session.
- **Has the codebase changed since last session?** Quick `git log --oneline -5`
  to see if other work has landed.
- **Are there blocking issues?** Check the session log's "Known Issues" or
  "Recommendations" sections.

If resuming, state what you're picking up and confirm with the developer before
proceeding.

### 4. Establish Session Intent

Before starting work, confirm:
- What is the goal of this session?
- What is the expected output? (code, design, investigation, etc.)
- What is out of scope?

---

## Mid-Session Checkpoints

For sessions longer than ~30 minutes or spanning multiple tasks:

- **Drift check**: "Am I still working toward the original session intent?"
- **Scope check**: "Have I stayed within the change budget (3 files, ~100 lines)?"
- **Git hygiene check**: "Is my working tree clean? Do I have uncommitted work that
  should be checkpointed?" If yes, commit with a descriptive message before continuing.
- **Context refresh**: If a new topic has emerged (e.g., Kafka came up mid-task),
  load the relevant topic context files.

---

## Post-Session

Execute these steps at the end of every session (or when the developer signals
they're wrapping up).

### 1. Convention Extraction

Review the session's work:
- Did I do something 3+ times that isn't documented as a convention?
- If yes → propose adding it to `project/conventions.md`

### 2. Pattern Candidacy

- Did I build something reusable that doesn't exist in the catalog?
- If yes → flag it with: topic, description, and suggested catalog ID
- Record in session log under "Patterns Proposed"

### 3. Friction Log

Note anything that was harder than it should have been:
- Missing context that would have helped
- Conventions that were unclear or contradictory
- Tools or scripts that didn't work as expected
- Record in session log under "Friction"

### 4. Confidence Annotations

Mark items the agent was uncertain about:
- Decisions made without full information (tag: `[uncertain]`)
- Assumptions that should be validated by a human (tag: `[needs-review]`)
- Areas where multiple valid approaches exist (tag: `[trade-off]`)

### 5. Git Closeout

Before logging the session:
- Run `git status` — there should be **no uncommitted changes**
- If changes exist: commit them with a clear message, or stash with a descriptive name
- Push the working branch to remote (`git push -u origin <branch>`)
- Verify: the branch is pushed and the working tree is clean

### 6. Session Log Update

Update `.agents/state/session-log.md` with a structured entry:

```markdown
## {date} — {session title}

### Intent
{What we set out to do}

### Completed
- {task 1}
- {task 2}

### Decisions Made
- {decision}: {rationale} [confidence: high|medium|low]

### Conventions Adopted
- {convention description} → added to {file}

### Patterns Proposed
- {pattern id}: {description}

### Issues Discovered
- {issue}: {severity} [status: open|resolved]

### Friction
- {what was hard and why}

### Open Threads
- {what's still in progress or unresolved}

### Next Steps
- {recommended next actions}
```

### 7. Quality Feedback Loop (Retro)

If work from a previous session turned out to be wrong or incomplete:
- Amend the original session log entry with a `### Retro ({date})` section
- Note what was wrong and what the correction was
- If a convention or pattern was based on the flawed work, update or remove it

---

## Cross-Session Pattern Recognition

The session log should be periodically reviewed (by the developer or a dedicated
analysis pass) for:

- **Recurring issues** — same problem appearing in 3+ sessions → should become
  a lint rule, convention, or catalog pattern
- **Recurring friction** — same missing context 3+ times → should become a
  topic file or convention update
- **Decision drift** — contradictory decisions across sessions → surface for
  developer resolution

---

## Decision Journal

Major decisions (architectural, convention, scope) should be recorded separately
from the session log narrative. Use this format in session log entries:

```
### Decisions Made
- **{decision}**: {rationale}
  - Alternatives considered: {list}
  - Confidence: high | medium | low
  - Revisit by: {date or condition, if applicable}
```

This enables future sessions to understand not just *what* was decided but *why*,
and whether the decision should be reconsidered.
