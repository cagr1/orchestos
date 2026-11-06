# Spec-Driven Workflow

OrchestOS supports a **Spec-Driven** mode where every task must have an approved specification before it can be executed. This ensures the agent has clear, verifiable acceptance criteria before writing any code.

## What is a Spec?

A spec is a markdown file stored at `.orchestos/specs/<task-id>.md`. It contains a YAML frontmatter block followed by structured markdown sections that describe the task context, what must be built, and concrete acceptance criteria.

### Frontmatter fields

| Field        | Type                                  | Description                                     |
|--------------|---------------------------------------|-------------------------------------------------|
| `id`         | string                                | Task identifier (matches tasks.yaml task id)    |
| `status`     | `draft` \| `approved`                 | Current spec status                             |
| `createdAt`  | ISO 8601 string                       | When the spec was created                       |
| `approvedAt` | ISO 8601 string (only if approved)    | When the spec was approved                      |
| `clarify`    | `pending` \| `resolved` \| `none`     | Clarification flag — blocks approval if pending |

### Markdown sections

```markdown
## Contexto
Background and motivation for the task.

## Descripción
What must be implemented, in enough detail for the agent.

## Criterios de aceptación
- [ ] Concrete, verifiable criterion #1
- [ ] Concrete, verifiable criterion #2

## Notas
Any relevant constraints, references, or edge cases.
```

## Workflow: create → draft → approve → run

### 1. Create a spec shell

```bash
orchestos spec create <task-id>
```

Creates `.orchestos/specs/<task-id>.md` with a template and `status: draft`.

### 2. Draft the spec body with LLM (optional)

```bash
orchestos spec draft <task-id> --description "Implement JWT authentication middleware"
```

Calls the LLM to fill in Contexto, Descripción, Criterios de aceptación, and Notas based on the task description. The spec remains `draft` — you should review and edit it.

### 3. Review and edit

Open the spec file and make sure:
- The acceptance criteria are **concrete and verifiable** (not vague like "works correctly").
- The description is clear enough for the agent to act on.
- If clarification is needed, set `clarify: pending` and resolve it before approving.

### 4. Approve

```bash
orchestos spec approve <task-id>
```

Validates the spec (checks that acceptance criteria are non-empty and non-placeholder), then sets `status: approved` and records `approvedAt`.

**Blocked if:**
- `clarify: pending` — resolve clarification first.
- Acceptance criteria section is empty or only contains `<criterio 1>` placeholders.

### 5. Run the task

```bash
orchestos task run <path> --id <task-id>
```

If `requireSpec: true` is set in `orchestos.config.yaml`, the harness will check for an approved spec before calling the LLM. Without an approved spec, the task throws:

```
Task '<id>' requires an approved spec. Run: orchestos spec approve <id>
```

## Enabling the spec gate

In `orchestos.config.yaml`:

```yaml
requireSpec: true
```

When this flag is set, **every** task run via `orchestos task run` must have a corresponding spec with `status: approved`. Tasks without an approved spec will be blocked at the harness level.

## Other commands

```bash
orchestos spec list [path]          # list all specs with id, status, clarify
orchestos spec show <task-id>       # print spec content to console
```

## Validation rules

`validateSpec` checks the spec body and returns `{ valid, errors }`:

- Fails if `## Criterios de aceptación` section is missing.
- Fails if the section is empty (no bullet items).
- Fails if all bullets are the literal placeholders `<criterio 1>` or `<criterio 2>`.

## End-to-end example

```bash
# 1. Create task in tasks.yaml (e.g. t1-auth)
# 2. Create spec
orchestos spec create t1-auth

# 3. Draft body via LLM
orchestos spec draft t1-auth --description "Add JWT middleware to Express routes"

# 4. Review, edit criteria, then approve
orchestos spec approve t1-auth
# → [spec] Approved: t1-auth

# 5. Enable the gate in orchestos.config.yaml:
#    requireSpec: true

# 6. Run the task — gate passes because spec is approved
orchestos task run . --id t1-auth
```
