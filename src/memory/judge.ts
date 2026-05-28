/**
 * src/memory/judge.ts
 *
 * S26.2 — LLM judge for memory conflict detection.
 * Given two memory entries (the newly upserted one and a BM25 candidate),
 * asks Haiku to classify their relationship.
 *
 * NOT called inside upsertMemory — the caller determines when to judge.
 */

import { chat } from '../providers/openrouter.ts'
import { getProvider } from '../providers/index.ts'

export type ConflictRelation =
  | 'conflict_with'
  | 'supersedes'
  | 'compatible'
  | 'scoped'
  | 'related'
  | 'not_conflict'

export interface ConflictJudgment {
  relation: ConflictRelation
  confidence: 'high' | 'medium' | 'low'
  explanation: string
}

const RELATIONS_DESCRIPTION = `
- conflict_with: The two entries contradict each other on the same topic.
- supersedes: The new entry replaces/obsoletes the existing one.
- compatible: Both entries can coexist without contradiction.
- scoped: The entries cover different scopes or aspects of the same topic.
- related: The entries are topically related but not directly comparable.
- not_conflict: The entries are unrelated or do not contradict each other.
`

function buildJudgePrompt(
  entryA: { topicKey: string; content: string },
  entryB: { topicKey: string; content: string },
): string {
  return `You are a memory conflict judge. Compare these two memory entries from the same project and determine their relationship.

ENTRY A (topic: ${entryA.topicKey}):
${entryA.content}

ENTRY B (topic: ${entryB.topicKey}):
${entryB.content}

RELATIONSHIPS:
${RELATIONS_DESCRIPTION}

Respond with ONLY a JSON object — no markdown fences, no prose, no explanation:
{
  "relation": "<one of the relationships above>",
  "confidence": "high|medium|low",
  "explanation": "one sentence explaining why"
}`
}

const VALID_RELATIONS: ConflictRelation[] = [
  'conflict_with', 'supersedes', 'compatible', 'scoped', 'related', 'not_conflict',
]

const VALID_CONFIDENCE = ['high', 'medium', 'low'] as const

function parseJudgment(text: string): ConflictJudgment {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      relation: 'not_conflict',
      confidence: 'low',
      explanation: `LLM returned unparseable response: ${text.slice(0, 200)}`,
    }
  }

  try {
    const obj = JSON.parse(jsonMatch[0])
    const relation = VALID_RELATIONS.includes(obj.relation)
      ? obj.relation as ConflictRelation
      : 'not_conflict'
    const confidence = VALID_CONFIDENCE.includes(obj.confidence)
      ? obj.confidence as 'high' | 'medium' | 'low'
      : 'low'
    return {
      relation,
      confidence,
      explanation: typeof obj.explanation === 'string'
        ? obj.explanation
        : 'No explanation provided.',
    }
  } catch {
    return {
      relation: 'not_conflict',
      confidence: 'low',
      explanation: `JSON parse error on: ${jsonMatch[0].slice(0, 200)}`,
    }
  }
}

/**
 * Given two memory entries, asks Haiku (via OpenRouter) to classify their
 * relationship. Returns the judgment even if the LLM response is malformed
 * (falls back to `not_conflict` / `low` confidence).
 *
 * @param entryA  The newly upserted memory entry
 * @param entryB  An existing memory entry (BM25 candidate)
 * @param modelOverride  Optional model override (default: anthropic/claude-3-haiku)
 */
export async function judgeConflict(
  entryA: { topicKey: string; content: string },
  entryB: { topicKey: string; content: string },
  modelOverride?: string,
): Promise<ConflictJudgment> {
  const model = modelOverride ?? 'anthropic/claude-3-haiku'

  let resp
  try {
    resp = await chat({
      model,
      system: 'You are a memory conflict judge that outputs only JSON.',
      messages: [{ role: 'user', content: buildJudgePrompt(entryA, entryB) }],
    })
  } catch {
    const provider = getProvider('openrouter')
    resp = await provider.chat({
      model,
      system: 'You are a memory conflict judge that outputs only JSON.',
      messages: [{ role: 'user', content: buildJudgePrompt(entryA, entryB) }],
    })
  }

  return parseJudgment(resp.text)
}
