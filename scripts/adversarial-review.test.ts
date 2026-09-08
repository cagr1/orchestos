import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendToReviewMd,
  extractAgentMessage,
  extractModelFromRollout,
  extractThreadId,
  findRolloutPath,
  formatReviewEntry,
  loadState,
  parseFindings,
  resolveDiffRange,
  REVIEW_MD,
  saveState,
  STATE_PATH,
  verifyModelUsed,
  type Finding,
  type RunCommand,
} from './adversarial-review.ts'

const cleanupPaths: string[] = []

afterEach(() => {
  for (const path of cleanupPaths.splice(0)) rmSync(path, { recursive: true, force: true })
})

function temp(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix))
  cleanupPaths.push(path)
  return path
}

const finding: Finding = {
  file: 'src/run/example.ts',
  line: 42,
  category: 'concurrencia',
  summary: 'Dos escritores pueden competir.',
  failure_scenario: 'Dos procesos escriben al mismo tiempo.',
  test_path: 'concurrency.check.ts',
  test_code: 'throw new Error("demostración")',
}

describe('adversarial review — estado y rango', () => {
  test('guarda y recupera el SHA revisado; estados inválidos no lanzan', () => {
    const root = temp('orchestos-adversarial-state-')
    expect(loadState(root)).toBeNull()

    saveState(root, { lastReviewedSha: 'abc123' })
    expect(loadState(root)).toEqual({ lastReviewedSha: 'abc123' })

    writeFileSync(join(root, STATE_PATH), '{ no es JSON')
    expect(loadState(root)).toBeNull()

    writeFileSync(join(root, STATE_PATH), JSON.stringify({ lastReviewedSha: 42 }))
    expect(loadState(root)).toBeNull()
  })

  test('resuelve el diff desde HEAD~1, el SHA persistido o nada nuevo según corresponda', () => {
    const root = temp('orchestos-adversarial-range-')
    const calls: string[][] = []
    const run: RunCommand = (args) => {
      calls.push(args)
      return { exitCode: 0, stdout: '', stderr: '' }
    }

    expect(resolveDiffRange(null, 'head-sha', run, root)).toEqual({ from: 'HEAD~1', to: 'head-sha' })
    expect(resolveDiffRange({ lastReviewedSha: 'head-sha' }, 'head-sha', run, root)).toBeNull()
    expect(resolveDiffRange({ lastReviewedSha: 'previous-sha' }, 'head-sha', run, root)).toEqual({
      from: 'previous-sha',
      to: 'head-sha',
    })
    expect(calls).toEqual([['git', 'cat-file', '-e', 'previous-sha']])
  })

  test('vuelve a HEAD~1 cuando el SHA persistido ya no existe', () => {
    const root = temp('orchestos-adversarial-rebase-')
    const run: RunCommand = () => ({ exitCode: 1, stdout: '', stderr: 'not found' })

    expect(resolveDiffRange({ lastReviewedSha: 'sha-viejo' }, 'head-sha', run, root)).toEqual({
      from: 'HEAD~1',
      to: 'head-sha',
    })
  })
})

describe('adversarial review — streams y rollouts', () => {
  test('extrae thread_id y el último mensaje del agente entre líneas inválidas', () => {
    const stream = [
      '{"type":"thread.started","thread_id":"abc-123"}',
      'esta línea no es JSON',
      '{"type":"item.completed","item":{"type":"agent_message","text":"primero"}}',
      '{"type":"item.completed","item":{"type":"agent_message","text":"último"}}',
    ].join('\n')

    expect(extractThreadId(stream)).toBe('abc-123')
    expect(extractAgentMessage(stream)).toBe('último')
    expect(extractThreadId('sin eventos')).toBeNull()
    expect(extractAgentMessage('sin eventos')).toBeNull()
  })

  test('extrae el modelo real del rollout o null si no fue declarado', () => {
    const rollout = ['basura', '{"type":"turn_context","payload":{"model":"gpt-5.6-sol"}}'].join('\n')
    expect(extractModelFromRollout(rollout)).toBe('gpt-5.6-sol')
    expect(extractModelFromRollout('{"type":"turn_context","payload":{}}')).toBeNull()
  })

  test('encuentra solo el rollout cuyo nombre termina con el thread_id', () => {
    const root = temp('orchestos-adversarial-rollouts-')
    const nested = join(root, '2026', '09', '08')
    mkdirSync(nested, { recursive: true })
    const expected = join(nested, 'rollout-2026-09-08T00-00-00-abc-123.jsonl')
    writeFileSync(expected, 'fixture')
    writeFileSync(join(nested, 'rollout-2026-09-08T00-00-00-other.jsonl'), 'fixture')

    expect(findRolloutPath('abc-123', root)).toBe(expected)
    expect(findRolloutPath('missing', root)).toBeNull()
    expect(findRolloutPath('abc-123', join(root, 'does-not-exist'))).toBeNull()
  })

  test('verifica el modelo esperado e informa el modelo real en un mismatch', () => {
    const root = temp('orchestos-adversarial-verify-')
    const nested = join(root, '2026', '09', '08')
    mkdirSync(nested, { recursive: true })
    writeFileSync(
      join(nested, 'rollout-2026-09-08T00-00-00-ok-thread.jsonl'),
      '{"type":"turn_context","payload":{"model":"gpt-5.6-sol"}}\n',
    )
    writeFileSync(
      join(nested, 'rollout-2026-09-08T00-00-00-other-thread.jsonl'),
      '{"type":"turn_context","payload":{"model":"otro-modelo"}}\n',
    )

    expect(verifyModelUsed('ok-thread', root, 'gpt-5.6-sol')).toEqual({
      ok: true,
      actualModel: 'gpt-5.6-sol',
    })
    expect(verifyModelUsed('other-thread', root, 'gpt-5.6-sol')).toEqual({
      ok: false,
      actualModel: 'otro-modelo',
    })
    expect(verifyModelUsed(null, root, 'gpt-5.6-sol')).toEqual({
      ok: false,
      actualModel: null,
      reason: 'sin thread_id en el stream',
    })
    expect(verifyModelUsed('missing-thread', root, 'gpt-5.6-sol')).toEqual({
      ok: false,
      actualModel: null,
      reason: 'rollout no encontrado',
    })
  })
})

describe('adversarial review — hallazgos y REVIEW.md', () => {
  test('parsea hallazgos fenced, filtra elementos incompletos y acepta el fallback JSON', () => {
    const valid = JSON.stringify(finding)
    const incomplete = JSON.stringify({ ...finding, test_code: undefined })
    expect(parseFindings(`respuesta\n\`\`\`json\n[${valid},${incomplete}]\n\`\`\``)).toEqual([finding])
    expect(parseFindings(`[${valid}]`)).toEqual([finding])
    expect(parseFindings('no es JSON')).toBeNull()
    expect(parseFindings('[]')).toEqual([])
  })

  test('formatea categoría, ubicación, evidencia y modelo sin reimplementar el formato', () => {
    const entry = formatReviewEntry(
      finding,
      'review-evidence/concurrency.check.ts',
      { from: 'from-sha', to: 'to-sha' },
      'gpt-5.6-sol',
    )

    expect(entry).toContain('concurrencia')
    expect(entry).toContain('src/run/example.ts:42')
    expect(entry).toContain('`review-evidence/concurrency.check.ts`')
    expect(entry).toContain('`gpt-5.6-sol`')
  })

  test('no crea REVIEW.md vacío e inserta nuevas entradas antes de las existentes sin duplicar header', () => {
    const root = temp('orchestos-adversarial-review-md-')
    const path = join(root, REVIEW_MD)
    appendToReviewMd(root, [])
    expect(existsSync(path)).toBe(false)

    appendToReviewMd(root, ['entrada vieja\n'])
    appendToReviewMd(root, ['entrada nueva\n'])
    const content = readFileSync(path, 'utf8')

    expect(content.match(/# REVIEW\.md/g)).toHaveLength(1)
    expect(content).toContain('entrada vieja')
    expect(content).toContain('entrada nueva')
    expect(content.indexOf('entrada nueva')).toBeLessThan(content.indexOf('entrada vieja'))
  })
})
