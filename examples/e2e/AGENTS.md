# e2e-hello — minimal smoke project

This is the smallest valid OrchestOS project. It exists to verify the full
execution pipeline against a live LLM API.

## Purpose

- One task: write `hello.txt` containing `OK`
- Two checks: file exists + content matches
- No dependencies, no skills, no prior context needed

## Running

```bash
cd examples/e2e
orchestos task run --id hello-world
```

Or from the repo root via the smoke script:

```bash
bun run e2e:smoke
```
