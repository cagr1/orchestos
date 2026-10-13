import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  buildDraftMessages,
  fallbackDraftOutput,
  parseDraftTaskClass,
} from '../dashboard/handlers/project.ts'
import { classifyTask } from '../router/classify.ts'
import { validateTask } from '../tasks/schema.ts'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-draft-ctx-'))
  dirs.push(root)
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src/a.ts'), 'export {}\n')
  return root
}

describe('buildDraftMessages', () => {
  it('sin contexto devuelve solo el mensaje actual (igual que antes)', () => {
    expect(buildDraftMessages('crea la tarea')).toEqual([
      { role: 'user', content: 'crea la tarea' },
    ])
    expect(buildDraftMessages('crea la tarea', {})).toEqual([
      { role: 'user', content: 'crea la tarea' },
    ])
  })

  it('con contexto incluye turnos previos y la respuesta del orquestador', () => {
    const msgs = buildDraftMessages('crea la tarea', {
      history: [
        { role: 'user', content: 'quiero src/a.ts' },
        { role: 'assistant', content: 'haría X' },
      ],
      assistantReply: 'Voy a modificar src/a.ts',
    })
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
    expect(msgs[0]?.content).toBe('quiero src/a.ts')
    expect(msgs[2]?.content).toContain('crea la tarea')
    expect(msgs[2]?.content).toContain('Voy a modificar src/a.ts')
  })

  it('acota a 6 turnos y 4000 caracteres, y no duplica el mensaje actual', () => {
    const history = Array.from({ length: 9 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `t${i}${'x'.repeat(5000)}`,
    }))
    history.push({ role: 'user', content: 'crea la tarea' })
    const msgs = buildDraftMessages('crea la tarea', { history, assistantReply: 'ok' })
    expect(msgs.every((m) => m.content.length <= 4000 + 400)).toBe(true)
    expect(
      msgs
        .map((m) => m.content)
        .join('\n')
        .match(/crea la tarea/g)?.length,
    ).toBe(1)
    expect(msgs.map((m) => m.content).join('\n')).not.toContain('t0x')
  })
})

describe('fallbackDraftOutput', () => {
  it('toma rutas entre backticks de la respuesta del orquestador', () => {
    const root = fixture()
    expect(
      fallbackDraftOutput('crea la tarea', root, { assistantReply: 'Tocaría `src/a.ts`.' }),
    ).toEqual(['src/a.ts'])
  })

  it('toma rutas entre backticks y negritas', () => {
    const root = fixture()
    expect(
      fallbackDraftOutput('crea la tarea', root, {
        assistantReply: 'Archivo: **`src/a.ts`**, nada más.',
      }),
    ).toEqual(['src/a.ts'])
  })

  it('conserva la limpieza previa de corchetes y paréntesis', () => {
    const root = fixture()
    expect(
      fallbackDraftOutput('crea la tarea', root, { assistantReply: '(ver [src/a.ts]).' }),
    ).toEqual(['src/a.ts'])
  })

  it('cae a los turnos previos, del más reciente al más antiguo', () => {
    const root = fixture()
    writeFileSync(join(root, 'README.md'), '#\n')
    const out = fallbackDraftOutput('crea la tarea', root, {
      history: [
        { role: 'user', content: 'mira README.md' },
        { role: 'assistant', content: 'cambio src/a.ts' },
      ],
    })
    expect(out).toEqual(['src/a.ts'])
  })

  it('sin contexto solo mira el mensaje actual', () => {
    const root = fixture()
    expect(fallbackDraftOutput('crea la tarea', root)).toEqual([])
    expect(fallbackDraftOutput('toca src/a.ts', root)).toEqual(['src/a.ts'])
  })
})

describe('task_class', () => {
  it('parseDraftTaskClass acepta los 5 valores y descarta el resto', () => {
    expect(parseDraftTaskClass('implement')).toBe('implement')
    expect(parseDraftTaskClass('otro')).toBeUndefined()
    expect(parseDraftTaskClass(undefined)).toBeUndefined()
    expect(parseDraftTaskClass(3)).toBeUndefined()
  })

  const base = { id: 'a-b', description: 'Crear el check de errores', output: ['x.md'] }

  it('el esquema valida task_class', () => {
    expect(validateTask({ ...base, task_class: 'implement' }, 0).task_class).toBe('implement')
    expect(validateTask(base, 0).task_class).toBeUndefined()
    expect(() => validateTask({ ...base, task_class: 'otro' }, 0)).toThrow(/unknown task_class/)
  })

  it('la clase declarada gana a la heurística de la descripción', () => {
    const t = validateTask({ ...base, task_class: 'implement' }, 0)
    // La lógica vieja (solo descripción) clasificaba esta tarea como fix.
    expect(classifyTask(t.description)).toBe('fix')
    expect(t.task_class ?? classifyTask(t.description)).toBe('implement')
  })
})
