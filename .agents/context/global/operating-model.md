# Global Context: Operating Model (Summary)

> Full document: `.agents/reference/operating-model.md`
> This file is a context-window-friendly summary for auto-loading.

## Session Lifecycle

Every session follows the outer loop defined in `global/lifecycle.md`:
1. **Pre-Session**: Load context (registry), orient on recent work, resumption check
2. **Work Loop**: Understand → Plan → Patch → Validate (inner loop, per task)
3. **Mid-Session**: Drift checks, scope checks, dynamic topic loading
4. **Post-Session**: Convention extraction, pattern candidacy, friction log, session log update

## Hard Rules

- Max 3 files, ~100 lines per iteration
- Never introduce dependencies, rewrite architecture, or scan entire repos without instruction
- Prefer stability over novelty; interfaces are contracts
- Declare uncertainty — never invent behavior (`[uncertain]`, `[needs-review]`)
- Flag security and data integrity risks immediately

## Communication

Concise, factual, no speculation. Lead with risks.
