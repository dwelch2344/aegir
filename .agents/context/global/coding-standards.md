# Global Context: Coding Standards

## Style

- Follow existing patterns in the file/module you're editing
- Match naming conventions already in use (don't introduce new ones)
- Preserve comments and intent markers
- Prefer clarity over cleverness; avoid unnecessary abstractions

## Safety

- Parameterized queries only — never string-concatenate user input into SQL
- No secrets in source; no sensitive data in logs
- Validate at system boundaries (GraphQL inputs, API params)
- Never bypass auth, weaken validation, or disable security checks

## Testing

- Suggest test cases for behavioral changes
- Identify failure modes and regression risks
- Don't assume tests exist — verify first
- Integration tests hit real databases (no mocks for data-layer tests)

## Version Control

- **Always work on a branch** — never commit directly to `main`
- **Commit before context-switching** — if work is in progress, commit (or stash) before moving to a different task; never leave dirty working trees across conversations
- **Commit at logical checkpoints** — each commit should represent a coherent unit of work, not a dump of accumulated changes
- **Push branches** — after committing, push to remote so work is not only local
- **Branch naming** — use `feature/`, `fix/`, `chore/` prefixes matching the work type
- **No orphaned work** — at session end, verify `git status` is clean; uncommitted changes are lost context

## Dependencies

- Do not add new dependencies without explicit approval
- Prefer existing utilities in `@aegir/common` and `@moribashi/*`
