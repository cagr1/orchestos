/**
 * src/chat/classify-task-intent.ts — B.1.b (Mes 18)
 *
 * Clasificador semántico de "¿el mensaje del usuario en el Chat describe
 * trabajo ejecutable sobre este repo, o es conversación?" — diseño aprobado
 * en docs/chat-task-detection-design.md (a), activado el 2026-07-09 con
 * evidencia real de 34 mensajes en chat_task_bar_events (2 falsos negativos
 * confirmados: pedidos de páginas web completas como primer mensaje de una
 * conversación nueva, la heurística de 3+ mensajes nunca los ofreció).
 *
 * Reglas del diseño aprobado:
 * - Modelo: el más barato disponible (deepseek/deepseek-v4-flash, mismo
 *   default del chat) — NUNCA el modelo que el usuario eligió para conversar.
 *   El fallback a Claude/GPT/Gemini vía supportsToolCalling() que el diseño
 *   describe como contingencia ("si no soporta la clasificación") no está
 *   implementado en esta primera versión — no hay evidencia todavía de que
 *   el modelo barato falle en una pregunta binaria de una sola línea.
 * - Input: SOLO el último mensaje del usuario, sin historial — call barato
 *   y determinista.
 * - Output: JSON `{ isTask: boolean, reason: string }`, parseo defensivo
 *   (mismo patrón que parsePatternSuggestions en analyze/patterns.ts) — ante
 *   cualquier fallo de parseo o de red, `isTask: false` (fail-safe: ante
 *   duda, no sugerir, la heurística de 3+ mensajes sigue como red de respaldo).
 */

import { chat as openrouterChat } from '../providers/openrouter.ts'

export interface TaskIntentResult {
  isTask: boolean
  reason: string
}

const CLASSIFIER_MODEL = 'deepseek/deepseek-v4-flash'

const SYSTEM_PROMPT = `You classify a single chat message sent to a coding-agent orchestrator. Decide whether it describes executable work on a software repository — building/writing/modifying code, files, or a UI; running a command; fixing a bug — versus a conversational question, opinion, or comment about the project's state.

Respond with ONLY a JSON object, no markdown fences, no extra text:
{"isTask": boolean, "reason": string}

"reason" is a short explanation (under 15 words), in the same language as the message.`

/**
 * Parser puro, testeable sin LLM — extrae el JSON de la respuesta cruda,
 * tolera fences de markdown, falla seguro a isTask:false ante cualquier
 * forma inesperada.
 */
export function parseTaskIntentResponse(raw: string): TaskIntentResult {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { isTask: false, reason: '' }
  }

  if (typeof parsed !== 'object' || parsed === null) return { isTask: false, reason: '' }
  const p = parsed as Record<string, unknown>
  return {
    isTask: p.isTask === true,
    reason: typeof p.reason === 'string' ? p.reason.slice(0, 200) : '',
  }
}

/**
 * Clasifica un mensaje. Nunca lanza — cualquier fallo de red/parseo cae a
 * isTask:false (fail-safe, la barra de 3+ mensajes sigue como red de respaldo).
 */
export async function classifyTaskIntent(message: string): Promise<TaskIntentResult> {
  try {
    const resp = await openrouterChat({
      model: CLASSIFIER_MODEL,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
      maxTokens: 150,
    })
    return parseTaskIntentResponse(resp.text)
  } catch {
    return { isTask: false, reason: '' }
  }
}
