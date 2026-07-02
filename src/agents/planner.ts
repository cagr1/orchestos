/**
 * Plan generation and parsing.
 *
 * Two paths — both produce the same SubTask[]:
 *
 *   YAML path  (S22.2, always available)
 *     parsePlan(yamlText)   — parse + validate a YAML string
 *     createPlan(yamlText)  — parse + validate + topoSort → SubTask[]
 *
 *   Function-calling path  (S23.1, provider-dependent)
 *     planWithFunctionCalling(description, parentTaskId, opts)
 *       — calls an LLM with the `create_subtask` tool N times; each call is
 *         schema-validated by the provider SDK before reaching this code.
 *
 *   Auto-detect entry point  (S23.2)
 *     generatePlan(description, parentTaskId, opts)
 *       — uses function calling when supported, YAML LLM fallback otherwise.
 *         Transparent to the caller.
 */

import { parse } from 'yaml'
import { readFileSync } from 'fs'
import { validateSubTask, validateSubTaskPlan, topoSort, VALID_TOOLS } from './sub-task-schema.ts'
import { createSubTask } from './sub-agent.ts'
import { callWithTools, supportsToolCalling, type ToolDef } from '../providers/tool-call.ts'
import { getProvider } from '../providers/index.ts'
import { ensureCatalogLoaded, contextWindowFor, DEFAULT_MAX_OUTPUT_TOKENS } from '../router/model-catalog.ts'
import { estimateTokens } from '../context/compress.ts'
import type { SubTask } from './sub-agent.ts'
import type { SubTaskDef, SubTaskPlan } from './sub-task-schema.ts'

export class PlanParseError extends Error {
  constructor(message: string, public readonly raw?: string) {
    super(message)
    this.name = 'PlanParseError'
  }
}

// ---------------------------------------------------------------------------
// YAML path (S22.2) — unchanged
// ---------------------------------------------------------------------------

/**
 * Parses YAML text into a validated SubTaskPlan.
 * Throws PlanParseError if YAML is malformed or validation fails.
 */
export function parsePlan(yamlText: string): SubTaskPlan {
  let raw: unknown
  try {
    raw = parse(yamlText)
  } catch (e) {
    throw new PlanParseError(`YAML parse error: ${(e as Error).message}`, yamlText)
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new PlanParseError('parsed YAML is not an object', yamlText)
  }

  try {
    return validateSubTaskPlan(raw)
  } catch (e) {
    throw new PlanParseError((e as Error).message, yamlText)
  }
}

/**
 * Parses YAML text, validates it, and returns fully initialized SubTask instances
 * in topological order (dependencies first).
 */
export function createPlan(yamlText: string): SubTask[] {
  const plan = parsePlan(yamlText)
  const sorted = topoSort(plan.sub_tasks)
  return sorted.map(def => createSubTask(def))
}

/**
 * Reads a YAML file and returns a ready-to-execute plan.
 */
export function parsePlanFromFile(filePath: string): SubTask[] {
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch (e) {
    throw new PlanParseError(`cannot read file "${filePath}": ${(e as Error).message}`)
  }
  return createPlan(content)
}

// ---------------------------------------------------------------------------
// Tool definition for function-calling path (S23.1)
// ---------------------------------------------------------------------------

export const CREATE_SUBTASK_TOOL: ToolDef = {
  name:        'create_subtask',
  description:
    'Define one sub-task in the decomposition plan. ' +
    'Call this tool once for each sub-task you want to create. ' +
    'Sub-tasks are executed in the order imposed by their depends_on graph.',
  input_schema: {
    type: 'object',
    required: ['id', 'description', 'acceptance', 'depends_on', 'allowed_tools'],
    properties: {
      id: {
        type:        'string',
        description: 'Unique kebab-case identifier within the plan (e.g. "write-schema").',
        pattern:     '^[a-z0-9]+(-[a-z0-9]+)*$',
      },
      description: {
        type:        'string',
        description: 'One-sentence statement of what this sub-task must accomplish.',
      },
      acceptance: {
        type:        'array',
        description: 'Verifiable acceptance criteria. At least one required.',
        items:       { type: 'string' },
        minItems:    1,
      },
      depends_on: {
        type:        'array',
        description: 'IDs of sub-tasks that must complete before this one starts. Use [] if none.',
        items:       { type: 'string' },
      },
      allowed_tools: {
        type:        'array',
        description: 'Tools this sub-task is permitted to use.',
        items:       { type: 'string', enum: [...VALID_TOOLS] },
      },
      topic_key: {
        type:        'string',
        description: 'Key for persisting the result in memory_entries. Required if output is absent.',
      },
      output: {
        type:        'array',
        description: 'File paths (relative to project root) the LLM may write. Required if topic_key is absent.',
        items:       { type: 'string' },
      },
      input: {
        type:        'array',
        description: 'File paths the LLM may read.',
        items:       { type: 'string' },
      },
    },
  },
}

const FUNCTION_CALLING_SYSTEM = `You are a task decomposition assistant.
Given a task description, decompose it into concrete sub-tasks by calling the create_subtask tool once per sub-task.
Rules:
- Each sub-task must have a unique kebab-case id.
- depends_on must reference only ids of other sub-tasks in this plan.
- allowed_tools must be a subset of: read, write, edit, bash, git.
- Every sub-task must have either output (file paths) or topic_key (or both).
- Order your calls so that dependencies are created before dependents (the plan is sorted automatically).`

const YAML_FALLBACK_SYSTEM = `You are a task decomposition assistant.
Given a task description, output a YAML plan with the following schema:

version: 1
parent_task_id: <id>
sub_tasks:
  - id: <kebab-case>
    description: <one sentence>
    acceptance:
      - <verifiable criterion>
    depends_on: []          # IDs of sub-tasks this depends on
    allowed_tools: [read, write, edit]
    topic_key: <optional>
    output:
      - <relative file path>

Rules:
- At least one sub-task required.
- Every sub-task needs output OR topic_key (or both).
- depends_on references must be valid IDs in the same plan.
- Output ONLY the YAML block, no markdown fences, no prose.`

// ---------------------------------------------------------------------------
// S23.1 — Function-calling path
// ---------------------------------------------------------------------------

export interface PlannerCallOverride {
  callWithTools: typeof callWithTools
}

/**
 * Generates a plan by calling the LLM with the `create_subtask` tool.
 * Each tool call is schema-validated by the provider SDK before reaching this code.
 *
 * @param description   Natural-language description of the parent task.
 * @param parentTaskId  ID for the plan envelope.
 * @param opts          Provider + model to use for the planner call.
 * @param _override     Optional dependency injection for testing.
 */
export async function planWithFunctionCalling(
  description: string,
  _parentTaskId: string,
  opts: { provider: string; model: string },
  _override?: PlannerCallOverride,
): Promise<SubTask[]> {
  const caller = _override?.callWithTools ?? callWithTools

  // Presupuesto real derivado del catálogo — nunca hardcodeado (hallazgo de
  // G.5: tool-call.ts tenía max_tokens=4096 fijo, sin forma de sobreescribirlo).
  await ensureCatalogLoaded()
  const userMessage = `Decompose the following task into sub-tasks:\n\n${description}`
  const promptTokens = estimateTokens(FUNCTION_CALLING_SYSTEM) + estimateTokens(userMessage)
  const PLANNER_SAFETY_MARGIN = 1024
  const available = contextWindowFor(opts.model) - promptTokens - PLANNER_SAFETY_MARGIN
  const maxTokens = available > 0 ? available : DEFAULT_MAX_OUTPUT_TOKENS

  let response: Awaited<ReturnType<typeof callWithTools>>
  try {
    response = await caller(opts.provider, opts.model, {
      system:      FUNCTION_CALLING_SYSTEM,
      userMessage,
      tools:       [CREATE_SUBTASK_TOOL],
      maxTokens,
    })
  } catch (e: any) {
    throw new PlanParseError(`function-calling planner failed: ${e.message}`)
  }

  const subtaskCalls = response.calls.filter(c => c.toolName === 'create_subtask')
  if (subtaskCalls.length === 0) {
    throw new PlanParseError('planner returned no create_subtask calls — cannot build plan')
  }

  const defs: SubTaskDef[] = subtaskCalls.map((call, i) => {
    try {
      return validateSubTask(call.input as Record<string, unknown>, i)
    } catch (e: any) {
      throw new PlanParseError(e.message)
    }
  })

  // Cross-validate: depends_on must reference known IDs
  const idSet = new Set(defs.map(d => d.id))
  const dupes = defs.map(d => d.id).filter((id, i, arr) => arr.indexOf(id) !== i)
  if (dupes.length > 0) {
    throw new PlanParseError(`duplicate sub-task ids from function calling: ${dupes.join(', ')}`)
  }
  for (const def of defs) {
    for (const dep of def.depends_on) {
      if (!idSet.has(dep)) {
        throw new PlanParseError(
          `[sub-task:${def.id}] depends_on references unknown id "${dep}"`
        )
      }
    }
  }

  const sorted = topoSort(defs)
  return sorted.map(def => createSubTask(def))
}

// ---------------------------------------------------------------------------
// S23.2 — Auto-detect entry point
// ---------------------------------------------------------------------------

/**
 * Generates a plan from a natural-language task description.
 *
 * Uses function calling when the provider supports it (S23.1).
 * Falls back to prompting the LLM for YAML output and parsing it (S22.2 path).
 * Transparent to the caller — both paths return the same SubTask[].
 *
 * @param description   Natural-language description of the parent task.
 * @param parentTaskId  ID for the plan envelope.
 * @param opts          Provider + model to use for the planner call.
 * @param _override     Optional dependency injection for testing.
 */
export async function generatePlan(
  description: string,
  parentTaskId: string,
  opts: { provider: string; model: string },
  _override?: PlannerCallOverride,
): Promise<SubTask[]> {
  if (supportsToolCalling(opts.provider, opts.model)) {
    return planWithFunctionCalling(description, parentTaskId, opts, _override)
  }

  // YAML fallback: prompt the LLM to output a YAML plan, then parse it
  const provider = getProvider(opts.provider)
  let text: string
  try {
    const resp = await provider.chat({
      model:    opts.model,
      system:   YAML_FALLBACK_SYSTEM,
      messages: [{ role: 'user', content: `parent_task_id: ${parentTaskId}\n\n${description}` }],
    })
    text = resp.text
  } catch (e: any) {
    throw new PlanParseError(`YAML fallback planner call failed: ${e.message}`)
  }

  // Strip possible markdown fences the model may have added despite instructions
  const cleaned = text.replace(/^```(?:yaml)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return createPlan(cleaned)
}
