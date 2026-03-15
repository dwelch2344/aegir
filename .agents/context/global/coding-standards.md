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

## Dependencies

- Do not add new dependencies without explicit approval
- Prefer existing utilities in `@aegir/common` and `@moribashi/*`
