/**
 * src/run/executors/single-shot.ts — G.2
 *
 * Extracción del bloque "LLM call → parse" que antes vivía inline en
 * harness.ts (una tarea = una llamada LLM que emite archivos completos en
 * <<<FILE:...>>>). Sin cambio de comportamiento — mismo mensaje de error,
 * mismo cálculo de costo, mismos tokens que antes.
 *
 * El harness distingue "la llamada al proveedor falló" de "el proveedor
 * respondió pero el parseo falló" porque cada caso escribe una fila de
 * evidencia distinta (F3): el primero tiene costo cero (no hubo respuesta),
 * el segundo ya gastó tokens reales. Los dos errores tipados abajo cargan
 * lo necesario para que el harness reconstruya exactamente esas dos filas
 * sin duplicar la lógica de cálculo de costo aquí y allá.
 */

import { calcCost } from '../../router/pricing.ts'
import { parseLLMResponse } from '../contract.ts'
import type { ExecutorEngine } from './types.ts'

export class ExecutorLLMCallError extends Error {}

export class ExecutorParseError extends Error {
  constructor(
    message: string,
    public inputTokens: number,
    public outputTokens: number,
    public usd: number,
  ) {
    super(message)
  }
}

export const singleShotEngine: ExecutorEngine = {
  async run(ctx, opts) {
    let llmResponse: Awaited<ReturnType<typeof ctx.provider.chat>>
    try {
      llmResponse = await ctx.provider.chat({
        model: ctx.model,
        system: ctx.prompt.system,
        messages: [{ role: 'user', content: ctx.prompt.userContent }],
        maxTokens: opts.maxTokens,
      })
    } catch (e: any) {
      throw new ExecutorLLMCallError(e.message)
    }

    const usd = calcCost(ctx.model, llmResponse.inputTokens, llmResponse.outputTokens)

    let parsed: ReturnType<typeof parseLLMResponse>
    try {
      parsed = parseLLMResponse(llmResponse.text)
    } catch (e: any) {
      throw new ExecutorParseError(e.message, llmResponse.inputTokens, llmResponse.outputTokens, usd)
    }

    return {
      files: parsed.files,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      usd,
      iterations: 1,
      costByIteration: [{
        label: 'single-shot',
        model: ctx.model,
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
        costUsd: usd,
      }],
      log: [],
    }
  },
}
