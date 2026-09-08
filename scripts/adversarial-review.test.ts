import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendToReviewMd,
  type CodexRunner,
  classifyFindingFailure,
  extractAgentMessage,
  extractModelFromRollout,
  extractThreadId,
  type Finding,
  findRolloutPath,
  formatReviewEntry,
  loadState,
  main,
  parseFindings,
  REVIEW_MD,
  type RunCommand,
  resolveDiffRange,
  resolveEvidencePath,
  runFindingTest,
  STATE_PATH,
  saveState,
  verifyModelUsed,
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

    expect(resolveDiffRange(null, 'head-sha', run, root)).toEqual({
      from: 'HEAD~1',
      to: 'head-sha',
    })
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
    const rollout = ['basura', '{"type":"turn_context","payload":{"model":"gpt-5.6-sol"}}'].join(
      '\n',
    )
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
  test('parsea solo arrays íntegros y rechaza elementos malformados', () => {
    const valid = JSON.stringify(finding)
    const incomplete = JSON.stringify({ ...finding, test_code: undefined })
    expect(parseFindings(`respuesta\n\`\`\`json\n[${valid},${incomplete}]\n\`\`\``)).toBeNull()
    expect(parseFindings(`[${valid}]`)).toEqual([finding])
    expect(parseFindings('no es JSON')).toBeNull()
    expect(parseFindings('[]')).toEqual([])
  })

  test('rechaza rutas absolutas, traversal, symlinks externos y destinos existentes', () => {
    const root = temp('orchestos-adversarial-path-')
    const evidence = join(root, 'review-evidence')
    mkdirSync(evidence, { recursive: true })
    expect(resolveEvidencePath(root, '/tmp/escape')).toBeNull()
    expect(resolveEvidencePath(root, '../escape')).toBeNull()
    expect(resolveEvidencePath(root, 'nested/../../escape')).toBeNull()
    expect(resolveEvidencePath(root, 'nested/proof')).toEqual({
      evidencePath: 'review-evidence/nested/proof.check.ts',
      fullPath: join(realpathSync(evidence), 'nested', 'proof.check.ts'),
    })
    const external = temp('orchestos-adversarial-external-')
    symlinkSync(external, join(evidence, 'linked-outside'))
    expect(resolveEvidencePath(root, 'linked-outside/proof')).toBeNull()
    writeFileSync(join(evidence, 'existing.check.ts'), 'old evidence')
    expect(resolveEvidencePath(root, 'existing')).toBeNull()
  })

  test('clasifica timeout, sintaxis, importación, infraestructura y solo acepta aserciones', () => {
    expect(classifyFindingFailure({ exitCode: 1, stdout: '', stderr: '', timedOut: true })).toBe(
      'timeout',
    )
    expect(
      classifyFindingFailure({ exitCode: 1, stdout: '', stderr: 'SyntaxError: unexpected token' }),
    ).toBe('syntax-error')
    expect(
      classifyFindingFailure({ exitCode: 1, stdout: '', stderr: 'Cannot find module x' }),
    ).toBe('import-error')
    expect(
      classifyFindingFailure({ exitCode: 1, stdout: '', stderr: 'sandbox denied permission' }),
    ).toBe('infrastructure-error')
    expect(
      classifyFindingFailure({
        exitCode: 1,
        stdout: 'error: expect(received).toBe(expected)\nExpected: 2\nReceived: 1',
        stderr: '',
      }),
    ).toBe('assertion-failed')
    expect(
      classifyFindingFailure({ exitCode: 1, stdout: '', stderr: 'Error: arbitrary failure' }),
    ).toBe('non-assertion-failure')
  })

  // H.10.2-bis — el test que faltaba, y su ausencia dejó pasar DOS bugs que se
  // anulaban entre sí en la observación: (1) el perfil de sandbox impedía que
  // cualquier binario arrancara (SIGABRT, salida vacía) y (2) `bun test <ruta>`
  // sin `./` trataba la ruta como filtro y no ejecutaba nada. Los tests
  // existentes solo verificaban que NADA escapara del sandbox — ninguno
  // verificaba que algo FUNCIONARA dentro. Un hallazgo legítimo tiene que
  // sobrevivir, o el revisor entero es un botón que no hace nada.
  test('un hallazgo legítimo sobrevive: la aserción corre de verdad y falla', async () => {
    const root = temp('orchestos-adversarial-legit-')
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'src', 'counter.ts'), 'export function bump(): number { return 2 }\n')
    const result = await runFindingTest(root, {
      ...finding,
      test_path: 'bump-should-return-one',
      test_code: [
        "import { expect, test } from 'bun:test'",
        "import { bump } from '../src/counter.ts'",
        "test('bump devuelve 1', () => { expect(bump()).toBe(1) })",
      ].join('\n'),
    })
    expect(result.reason).toBe('assertion-failed')
    expect(result.survived).toBe(true)
    // Prueba de que la aserción se EJECUTÓ, no solo de que el proceso murió:
    // sin esto, un binario que no arranca daría exit≠0 y pasaría por hallazgo.
    expect(`${result.stdout}${result.stderr}`).toContain('expect() calls')
  })

  // H.10.2-bis — este test verifica la frontera REAL que el perfil promete, que
  // no es la que se escribió primero. La lectura amplia se permite a propósito
  // (acotarla impedía que ningún binario arrancara — ver sandboxProfile): lo que
  // se garantiza es que el código escrito por el LLM no pueda ESCRIBIR fuera de
  // su temporal, no pueda salir por RED, y no pueda leer CREDENCIALES conocidas.
  // Sin red, leer no permite exfiltrar. Las tres aserciones de abajo PASAN
  // dentro del sandbox, por eso el veredicto correcto es 'test-passed'.
  test('el sandbox bloquea de verdad escritura externa, red y credenciales', async () => {
    const root = temp('orchestos-adversarial-sandbox-root-')
    const credential = join(process.env.HOME ?? '', '.ssh', 'h10-sandbox-probe')
    mkdirSync(join(process.env.HOME ?? '', '.ssh'), { recursive: true })
    writeFileSync(credential, 'no debe leerse')
    const escapeTarget = join(temp('orchestos-adversarial-escape-'), 'escaped.txt')
    const server = Bun.serve({ port: 0, fetch: () => new Response('network escaped') })
    try {
      const result = await runFindingTest(root, {
        ...finding,
        test_path: 'sandbox-boundary',
        test_code: [
          "import { expect, test } from 'bun:test'",
          "import { readFileSync, writeFileSync } from 'node:fs'",
          `test('escritura externa bloqueada', () => { expect(() => writeFileSync(${JSON.stringify(escapeTarget)}, 'x')).toThrow() })`,
          `test('credencial bloqueada', () => { expect(() => readFileSync(${JSON.stringify(credential)}, 'utf8')).toThrow() })`,
          `test('red bloqueada', async () => { await expect(fetch(${JSON.stringify(server.url.toString())})).rejects.toThrow() })`,
        ].join('\n'),
      })
      // Las 3 fronteras se sostuvieron -> el test pasa -> no demuestra ningún bug.
      expect(result.reason).toBe('test-passed')
      expect(result.survived).toBe(false)
      // Prueba de que las aserciones CORRIERON, no de que el proceso murió.
      expect(`${result.stdout}${result.stderr}`).toContain('3 pass')
      expect(result.outcomePath).not.toBeNull()
      expect(existsSync(join(root, result.outcomePath as string))).toBe(true)
      expect(existsSync(escapeTarget)).toBe(false)
    } finally {
      rmSync(credential, { force: true })
      server.stop(true)
    }
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

describe('adversarial review — fail closed', () => {
  test('no avanza lastReviewedSha si Codex falla, no responde o entrega JSON malformado', async () => {
    const root = temp('orchestos-adversarial-fail-closed-')
    mkdirSync(join(root, 'scripts'), { recursive: true })
    writeFileSync(join(root, 'scripts', 'adversarial-review-prompt.md'), '{{DIFF}}')
    const sessions = join(root, 'sessions')
    mkdirSync(sessions, { recursive: true })
    writeFileSync(
      join(sessions, 'rollout-any-thread.jsonl'),
      '{"type":"turn_context","payload":{"model":"gpt-5.6-sol"}}\n',
    )
    const run: RunCommand = (args) => {
      if (args[0] === 'git' && args[1] === 'rev-parse')
        return { exitCode: 0, stdout: 'head-sha\n', stderr: '' }
      if (args[0] === 'git' && args[1] === 'diff')
        return { exitCode: 0, stdout: 'diff', stderr: '' }
      return { exitCode: 0, stdout: '', stderr: '' }
    }
    const cases: CodexRunner[] = [
      async () => ({ exitCode: 1, timedOut: false, stdout: '', stderr: 'failed' }),
      async () => ({
        exitCode: 0,
        timedOut: false,
        stdout: '{"type":"thread.started","thread_id":"any-thread"}\n',
        stderr: '',
      }),
      async () => ({
        exitCode: 0,
        timedOut: false,
        stdout:
          '{"type":"thread.started","thread_id":"any-thread"}\n{"type":"item.completed","item":{"type":"agent_message","text":"not json"}}',
        stderr: '',
      }),
      async () => ({
        exitCode: 0,
        timedOut: false,
        stdout:
          '{"type":"thread.started","thread_id":"any-thread"}\n{"type":"item.completed","item":{"type":"agent_message","text":"[{\\"file\\":\\"x\\"}]"}}',
        stderr: '',
      }),
    ]
    for (const runner of cases) {
      expect(await main(root, run, sessions, 'gpt-5.6-sol', runner)).toBe(1)
      expect(existsSync(join(root, STATE_PATH))).toBe(false)
    }
  })
})
