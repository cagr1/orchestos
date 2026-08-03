# Auditoría de procedencia nominal de skills

Fecha de consulta: 2026-08-03.

Esta auditoría cubre las 24 skills locales: 16 en `skills/` y 8 en
`skills/pro/`. La búsqueda se hizo vía GitHub API (`gh api`) contra los
árboles completos de skills de:

- `obra/superpowers`, rama `main`, commit `44c9b2d6e889982ac18c27d05a19fefe335194e1`.
- `mattpocock/skills`, rama `main`, commit `2ab958093e83e0ec752e6c1c5932da465bf23e0c`.

“Exacto” significa que el nombre local y el nombre de la skill upstream
coinciden. “Parcial” significa que hay una semejanza visible en el nombre o
en un segmento del nombre/ruta. “Ninguno” significa que no se encontró un
archivo con nombre igual o parecido en los árboles auditados. Esta tabla solo
registra evidencia; no decide si una coincidencia es copia, derivación o
trabajo independiente.

El tamaño es el campo `size` en bytes devuelto por GitHub Contents API. Los
fragmentos `E1`, `E3`–`E12` reproducen literalmente las primeras 15 líneas de cada
archivo candidato. No se resumió ni parafraseó contenido upstream.

| Skill local | Candidato upstream (repo + path) | Tamaño | Parecido del nombre | Evidencia literal |
|---|---|---:|---|---|
| `skills/api-contract.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/context-compression.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/design-brief-inference.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/design-tokens.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/diagnose.yaml` | `mattpocock/skills` — `skills/engineering/diagnosing-bugs/SKILL.md` | 8536 | parcial (`diagnos…`) | E7 |
| `skills/fix-typescript-errors.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/frontend-design.yaml` | `mattpocock/skills` — `skills/deprecated/design-an-interface/SKILL.md` | 3366 | parcial (`design`) | E11 |
| `skills/generate-prisma-migration.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/improve-architecture.yaml` | `mattpocock/skills` — `skills/engineering/improve-codebase-architecture/SKILL.md` | 6039 | parcial (`improve`, `architecture`) | E8 |
| `skills/pre-task-alignment.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/qa-structured.yaml` | `mattpocock/skills` — `skills/deprecated/qa/SKILL.md` | 4965 | parcial (`qa`) | E10 |
| `skills/security-review.yaml` | `mattpocock/skills` — `skills/engineering/code-review/SKILL.md` | 6740 | parcial (`review`) | E6 |
| `skills/summarize-pr-diff.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/tdd-enforcer.yaml` | `obra/superpowers` — `skills/test-driven-development/SKILL.md`<br>`mattpocock/skills` — `skills/engineering/tdd/SKILL.md` | 9015<br>3213 | parcial (`test`, `development`)<br>parcial (`tdd`) | E1<br>E9 |
| `skills/test-writer.yaml` | `obra/superpowers` — `skills/test-driven-development/SKILL.md`<br>`mattpocock/skills` — `skills/engineering/tdd/SKILL.md` | 9015<br>3213 | parcial (`test`)<br>parcial (`tdd`, `test`) | E1<br>E9 |
| `skills/ux-guidelines.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/pro/api-contract.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/pro/bug-hypothesis.yaml` | `obra/superpowers` — `skills/systematic-debugging/SKILL.md`<br>`mattpocock/skills` — `skills/engineering/diagnosing-bugs/SKILL.md` | 9465<br>8536 | parcial (`debugging` / hipótesis de bug)<br>parcial (`bug` / `diagnos…`) | E3<br>E7 |
| `skills/pro/code-review.yaml` | `obra/superpowers` — `skills/receiving-code-review/SKILL.md`<br>`obra/superpowers` — `skills/requesting-code-review/SKILL.md`<br>`mattpocock/skills` — `skills/engineering/code-review/SKILL.md` | 6203<br>2956<br>6740 | parcial (`code-review`)<br>parcial (`code-review`)<br>exact (`code-review`) | E4<br>E5<br>E6 |
| `skills/pro/db-migration-safe.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/pro/doc-gen.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/pro/perf-profile.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/pro/pr-description.yaml` | sin candidato | — | ninguno | sin candidato |
| `skills/pro/refactor-guided.yaml` | `mattpocock/skills` — `skills/deprecated/request-refactor-plan/SKILL.md` | 2711 | parcial (`refactor`) | E12 |

## Fragmentos literales de candidatos

### E1 — `obra/superpowers/skills/test-driven-development/SKILL.md` — 9015 bytes

```text
---
name: test-driven-development
description: Use when implementing any feature or bugfix, before writing implementation code
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**
```

### E3 — `obra/superpowers/skills/systematic-debugging/SKILL.md` — 9465 bytes

```text
---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic Debugging

## Overview

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law
```

### E4 — `obra/superpowers/skills/receiving-code-review/SKILL.md` — 6203 bytes

```text
---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
---

# Code Review Reception

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern
```

### E5 — `obra/superpowers/skills/requesting-code-review/SKILL.md` — 2956 bytes

```text
---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
```

### E6 — `mattpocock/skills/skills/engineering/code-review/SKILL.md` — 6740 bytes

```text
---
name: code-review
description: Review the changes since a fixed point (commit, branch, tag, or merge-base) along two axes — Standards (does the code follow this repo's documented coding standards?) and Spec (does the code match what the originating issue/PRD asked for?). Runs both reviews in parallel sub-agents and reports them side by side. Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to "review since X".
---

Two-axis review of the diff between `HEAD` and a fixed point the user supplies:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

Both axes run as **parallel sub-agents** so they don't pollute each other's context, then this skill aggregates their findings.

The issue tracker should have been provided to you — run `/setup-matt-pocock-skills` if `docs/agents/issue-tracker.md` is missing.

## Process
```

### E7 — `mattpocock/skills/skills/engineering/diagnosing-bugs/SKILL.md` — 8536 bytes

```text
---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and performance regressions. Use when the user says "diagnose"/"debug this", or reports something broken/throwing/failing/slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring the codebase, read `CONTEXT.md` (if it exists) to get a clear mental model of the relevant modules, and check ADRs in the area you're touching.

## Phase 1 — Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug — one that goes red on _this_ bug — you will find the cause; bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at the code will save you.
```

### E8 — `mattpocock/skills/skills/engineering/improve-codebase-architecture/SKILL.md` — 6039 bytes

```text
---
name: improve-codebase-architecture
description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
disable-model-invocation: true
---

# Improve Codebase Architecture

Surface architectural friction and propose **deepening opportunities** — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability.

This command is _informed_ by the project's domain model and built on a shared design vocabulary:

- Run the `/codebase-design` skill for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles (the deletion test, "the interface is the test surface", "one adapter = hypothetical seam, two = real"). Use these terms exactly in every suggestion — don't drift into "component," "service," "API," or "boundary."
```

### E9 — `mattpocock/skills/skills/engineering/tdd/SKILL.md` — 3213 bytes

```text
---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests.
---

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, what to test, and the rules of the loop. Every section applies on every cycle — consult them before and during the loop, not after.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists — and survives refactors because it doesn't care about internal structure.
```

### E10 — `mattpocock/skills/skills/deprecated/qa/SKILL.md` — 4965 bytes

```text
---
name: qa
description: Interactive QA session where user reports bugs or issues conversationally, and the agent files GitHub issues. Explores the codebase in the background for context and domain language. Use when user wants to report bugs, do QA, file issues, or mentions "QA session".
---

# QA Session

Run an interactive QA session. The user describes problems they're encountering. You clarify, explore the codebase for context, and file GitHub issues.

## For each issue the user raises

### 1. Listen and lightly clarify

Before exploring the codebase, ask at most 2-3 short clarifying questions focused on the user-visible behavior.
```

### E11 — `mattpocock/skills/skills/deprecated/design-an-interface/SKILL.md` — 3366 bytes

```text
---
name: design-an-interface
description: Generate multiple radically different interface designs for a module using parallel sub-agents. Use when user wants to design an API, explore interface options, compare module shapes, or mentions "design it twice".
---

# Design an Interface

Based on "Design It Twice" from "A Philosophy of Software Design": your first idea is unlikely to be the best. Generate multiple radically different designs, then compare.

## Workflow

### 1. Gather Requirements

Before designing, understand:
```

### E12 — `mattpocock/skills/skills/deprecated/request-refactor-plan/SKILL.md` — 2711 bytes

```text
---
name: request-refactor-plan
description: Create a detailed refactor plan with tiny commits via user interview, then file it as a GitHub issue. Use when user wants to plan a refactor, create a refactoring RFC, or break a refactor into safe incremental steps.
---

This skill will be invoked when the user wants to create a refactor request. You should go through the steps below. You may skip steps if you don't consider them necessary.

1. Ask the user for a long, detailed description of the problem they want to solve and any potential ideas for solutions.

2. Explore the repo to verify their assertions and understand the current state of the codebase.

3. Ask whether they have considered other options, and present other options to them.

4. Interview the user about the implementation. Be extremely detailed and thorough.
```

## Límites de esta auditoría

- No se modificó ningún archivo `.yaml` de `skills/`.
- No se determinó procedencia, copia, derivación ni independencia de ningún candidato.
- No se resumió ni parafraseó contenido upstream; los únicos contenidos upstream incluidos son los fragmentos literales iniciales de los candidatos.
- La ausencia de candidato significa ausencia de coincidencia nominal en los árboles completos consultados, no prueba de que no exista inspiración o relación conceptual.
