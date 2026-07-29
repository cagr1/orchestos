# Security Gate

Run the complete reproducible gate with:

```sh
bun run security:gate
```

The command fails on the first non-zero result and runs, in order:

1. TypeScript typecheck.
2. Database initialization in a temporary `ORCHESTOS_HOME`, so tests cannot
   modify or close the developer's `~/.orchestos/db.sqlite`.
3. The complete Bun test matrix serially and in isolated workers, with coverage
   written to `coverage/security-gate`.
4. `bun audit --audit-level=high`, which rejects high and critical advisories.

The temporary database is removed in a `finally` block even when a check fails.
The dependency audit intentionally has no offline fallback: an unavailable
advisory service is a gate failure, not evidence that dependencies are safe.
