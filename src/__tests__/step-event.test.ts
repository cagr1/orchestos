/**
 * G.3.2 — traductores CLI → ExecutorStepEvent. Fixtures tomados de probes en
 * vivo reales (2026-07-27, ver comentarios de step-event.ts), no inventados.
 */

import { describe, expect, it } from 'bun:test'
import {
  claudeEventToStep,
  codexEventToStep,
  opencodeEventToStep,
} from '../run/executors/step-event.ts'

describe('claudeEventToStep', () => {
  it('assistant con bloque de texto → step "text"', () => {
    const steps = claudeEventToStep({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'hola' }] },
    })
    expect(steps).toEqual([{ type: 'text', label: 'text', detail: 'hola' }])
  })

  it('assistant con bloque tool_use → step "tool_use" con input serializado', () => {
    const steps = claudeEventToStep({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] },
    })
    expect(steps).toEqual([{ type: 'tool_use', label: 'Bash', detail: '{"command":"ls"}' }])
  })

  it('assistant con texto + tool_use en el mismo mensaje → 2 steps', () => {
    const steps = claudeEventToStep({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'voy a listar' },
          { type: 'tool_use', name: 'Bash', input: { command: 'ls' } },
        ],
      },
    })
    expect(steps).toHaveLength(2)
    expect(steps[0]!.type).toBe('text')
    expect(steps[1]!.type).toBe('tool_use')
  })

  it('result → step "step_finish" con costo y tokens', () => {
    const steps = claudeEventToStep({
      type: 'result',
      total_cost_usd: 0.0123,
      usage: { input_tokens: 1234, output_tokens: 567 },
    })
    expect(steps).toEqual([
      {
        type: 'step_finish',
        label: 'step_finish',
        costUsd: 0.0123,
        tokens: { input: 1234, output: 567 },
      },
    ])
  })

  it('evento system/hook_started (ruido de sesión real) → [] sin romper', () => {
    expect(claudeEventToStep({ type: 'system', subtype: 'hook_started' })).toEqual([])
  })

  it('línea no-objeto o null → [] sin throw', () => {
    expect(claudeEventToStep(null)).toEqual([])
    expect(claudeEventToStep('not an object')).toEqual([])
  })
})

describe('opencodeEventToStep', () => {
  it('tool_use (bash real) → step "tool_use" con título', () => {
    const steps = opencodeEventToStep({
      type: 'tool_use',
      part: { type: 'tool', tool: 'bash', state: { title: 'ls' } },
    })
    expect(steps).toEqual([{ type: 'tool_use', label: 'bash', detail: 'ls' }])
  })

  it('text → step "text"', () => {
    const steps = opencodeEventToStep({
      type: 'text',
      part: { type: 'text', text: 'I am done.' },
    })
    expect(steps).toEqual([{ type: 'text', label: 'text', detail: 'I am done.' }])
  })

  it('step_finish → step "step_finish" con costo y tokens', () => {
    const steps = opencodeEventToStep({
      type: 'step_finish',
      part: { type: 'step-finish', cost: 0.0041, tokens: { input: 9865, output: 43 } },
    })
    expect(steps).toEqual([
      {
        type: 'step_finish',
        label: 'step_finish',
        costUsd: 0.0041,
        tokens: { input: 9865, output: 43 },
      },
    ])
  })

  it('step_start (sin info mapeable) → []', () => {
    expect(opencodeEventToStep({ type: 'step_start', part: { type: 'step-start' } })).toEqual([])
  })

  it('línea no-objeto o null → [] sin throw', () => {
    expect(opencodeEventToStep(null)).toEqual([])
    expect(opencodeEventToStep(undefined)).toEqual([])
  })
})

describe('codexEventToStep', () => {
  it('item.completed agent_message → step "text"', () => {
    const steps = codexEventToStep({
      type: 'item.completed',
      item: { id: 'item_9', type: 'agent_message', text: 'Creé hello.txt con el contenido `hi`.' },
    })
    expect(steps).toEqual([
      { type: 'text', label: 'text', detail: 'Creé hello.txt con el contenido `hi`.' },
    ])
  })

  it('item.completed command_execution → step "tool_use" con el comando', () => {
    const steps = codexEventToStep({
      type: 'item.completed',
      item: {
        id: 'item_6',
        type: 'command_execution',
        command: "/bin/zsh -lc 'ls -la /private/tmp/codex-probe'",
      },
    })
    expect(steps).toEqual([
      {
        type: 'tool_use',
        label: 'command',
        detail: "/bin/zsh -lc 'ls -la /private/tmp/codex-probe'",
      },
    ])
  })

  it('item.completed file_change → step "tool_use" con los paths', () => {
    const steps = codexEventToStep({
      type: 'item.completed',
      item: {
        id: 'item_8',
        type: 'file_change',
        changes: [{ path: '/private/tmp/codex-probe/hello.txt', kind: 'add' }],
      },
    })
    expect(steps).toEqual([
      { type: 'tool_use', label: 'file_change', detail: '/private/tmp/codex-probe/hello.txt' },
    ])
  })

  it('item.completed error → [] (informational, no se muestra como fallo)', () => {
    const steps = codexEventToStep({
      type: 'item.completed',
      item: { id: 'item_0', type: 'error', text: 'Skill descriptions were shortened...' },
    })
    expect(steps).toEqual([])
  })

  it('item.started (no item.completed) → [] — evita filas duplicadas a medio terminar', () => {
    const steps = codexEventToStep({
      type: 'item.started',
      item: { id: 'item_2', type: 'command_execution', command: 'pwd' },
    })
    expect(steps).toEqual([])
  })

  it('turn.completed → step "step_finish" con tokens, sin costo (codex no lo expone)', () => {
    const steps = codexEventToStep({
      type: 'turn.completed',
      usage: { input_tokens: 71345, output_tokens: 533 },
    })
    expect(steps).toEqual([
      { type: 'step_finish', label: 'step_finish', tokens: { input: 71345, output: 533 } },
    ])
  })

  it('thread.started / turn.started (ruido de sesión real) → [] sin romper', () => {
    expect(codexEventToStep({ type: 'thread.started', thread_id: 'abc' })).toEqual([])
    expect(codexEventToStep({ type: 'turn.started' })).toEqual([])
  })

  it('línea no-objeto o null → [] sin throw', () => {
    expect(codexEventToStep(null)).toEqual([])
    expect(codexEventToStep(undefined)).toEqual([])
  })
})
