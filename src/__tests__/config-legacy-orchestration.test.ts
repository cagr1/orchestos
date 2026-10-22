import { afterEach, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadOrcheConfig } from '../config/load.ts'

const dirs: string[] = []
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
})

it('un YAML viejo con la clave `orchestration` (incluso inválida) carga sin error y se ignora', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-legacy-orch-'))
  dirs.push(dir)
  writeFileSync(
    join(dir, 'orchestos.config.yaml'),
    'config_version: 1\nagent: claude\norchestration:\n  enabled: "si"\n',
  )
  const cfg = loadOrcheConfig(dir)
  expect(cfg.agent).toBe('claude')
  expect('orchestration' in cfg).toBe(false)
})

it.each(['claude', 'codex', 'opencode'])(
  'migración legacy: con agent=%s (CLI conocido) no traduce models.executor_heavy al rol Ejecutor',
  (agent) => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-legacy-exec-'))
    dirs.push(dir)
    writeFileSync(
      join(dir, 'orchestos.config.yaml'),
      `config_version: 1\nagent: ${agent}\nmodels:\n  executor_heavy: openrouter/some-model\n`,
    )
    const cfg = loadOrcheConfig(dir) as { roles?: { executor?: unknown } }
    expect(cfg.roles?.executor).toBeUndefined()
  },
)

it('migración legacy: con agent=api sí traduce models.executor_heavy al rol Ejecutor', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-legacy-exec-'))
  dirs.push(dir)
  writeFileSync(
    join(dir, 'orchestos.config.yaml'),
    'config_version: 1\nagent: api\nmodels:\n  executor_heavy: openrouter/some-model\n',
  )
  const cfg = loadOrcheConfig(dir) as { roles?: { executor?: { agent: string } } }
  expect(cfg.roles?.executor?.agent).toBe('api')
})
