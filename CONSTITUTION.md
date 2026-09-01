# CONSTITUTION.md
# Defines what the agent CAN and CANNOT do in this project.
# Injected into every task prompt automatically.
# Docs: https://github.com/cagr1/orchestos

## ALLOWED
- Modify files under src/
- Create new test files under tests/ or __tests__/
- Update package.json dependencies

## FORBIDDEN
- Modify .env or .env.* files
- Delete existing files (use deprecation comments instead)
- Modify files under src/db/migrations/
- Hardcode secrets or API keys

## REQUIRE_CONFIRMATION
- Any change to src/db/schema.ts
- Any change to authentication logic
- Any change to public API contracts
