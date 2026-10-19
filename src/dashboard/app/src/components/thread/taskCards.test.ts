import { describe, expect, test } from 'bun:test'
import type { ChatMessage } from '../../types/orchestos'
import { buildTaskCards, taskDetail, taskName } from './taskCards'

function msg(id: string, over: Partial<ChatMessage> = {}): ChatMessage {
  return { id, role: 'assistant', content: '', timestamp: '', ...over }
}
const held = (id: string, taskId: string, description = 'Fix lint') =>
  msg(id, {
    taskId,
    taskHeld: true,
    content: 'Plan',
    proposedTask: { id: taskId, description, output: [] },
  })
const report = (id: string, taskId: string, taskReport: ChatMessage['taskReport'], content = 'r') =>
  msg(id, { taskId, taskReport, content })

describe('buildTaskCards', () => {
  test('held', () => {
    const cards = buildTaskCards([held('1', 't')])
    expect(cards.byTask.get('t')?.state).toBe('held')
    expect(cards.hidden.size).toBe(0)
  })

  test('lanzado sin reporte es running', () => {
    const launched = msg('1', { taskId: 't', taskHeld: false, content: 'Plan' })
    expect(buildTaskCards([launched]).byTask.get('t')?.state).toBe('running')
  })

  test('failed → retry → done: una tarjeta, reportes ocultos', () => {
    const cards = buildTaskCards([
      held('1', 't'),
      report('2', 't', { outcome: 'pending', attempt: 1, maxAttempts: 3 }),
      report('3', 't', { outcome: 'done', provider: 'codex', model: 'luna' }),
    ])
    const card = cards.byTask.get('t')
    expect(card?.anchorId).toBe('1')
    expect(card?.state).toBe('done')
    expect(card?.reports.map((item) => item.state)).toEqual(['failed', 'done'])
    expect(card?.reports[1]?.model).toBe('codex/luna')
    expect([...cards.hidden]).toEqual(['2', '3'])
  })

  test('Retry en curso muestra running', () => {
    const cards = buildTaskCards([held('1', 't'), report('2', 't', { outcome: 'failed' })], {
      '2': true,
    })
    expect(cards.byTask.get('t')?.state).toBe('running')
  })

  test('blocked por árbol sucio', () => {
    const cards = buildTaskCards([
      held('1', 't'),
      report('2', 't', { outcome: 'pending', dirtyFiles: ['a.ts'] }),
    ])
    expect(cards.byTask.get('t')?.state).toBe('blocked')
    expect(cards.byTask.get('t')?.reports[0]?.dirtyFiles).toEqual(['a.ts'])
  })

  test('el reporte terminado conserva runId para cargar la evidencia', () => {
    const card = buildTaskCards([
      held('1', 't'),
      report('2', 't', { outcome: 'done', runId: 'run-123' }),
    ]).byTask.get('t')
    expect(card?.reports.at(-1)?.runId).toBe('run-123')
  })

  test('mensaje viejo sin campos nuevos deriva del outcome y del content', () => {
    const failed = buildTaskCards([
      held('1', 't'),
      report('2', 't', { outcome: 'pending' }, '✗ Task `t` failed · attempt 1/3'),
    ])
    expect(failed.byTask.get('t')?.state).toBe('failed')
    const pending = buildTaskCards([held('1', 't'), report('2', 't', { outcome: 'pending' })])
    expect(pending.byTask.get('t')?.state).toBe('pending')
  })

  test('dos tareas intercaladas', () => {
    const cards = buildTaskCards([
      held('1', 'a'),
      held('2', 'b'),
      report('3', 'a', { outcome: 'done' }),
      report('4', 'b', { outcome: 'failed' }),
    ])
    expect(cards.byTask.get('a')?.state).toBe('done')
    expect(cards.byTask.get('b')?.state).toBe('failed')
    expect(cards.byTask.get('a')?.anchorId).toBe('1')
    expect(cards.byTask.get('b')?.anchorId).toBe('2')
    expect([...cards.hidden]).toEqual(['3', '4'])
  })

  test('el texto del ancla no se repite si es la descripción', () => {
    const same = msg('1', {
      taskId: 't',
      taskHeld: true,
      content: ' Fix lint ',
      proposedTask: { id: 't', description: 'Fix lint', output: [] },
    })
    expect(buildTaskCards([same]).byTask.get('t')?.showAnchorText).toBe(false)
    expect(buildTaskCards([held('1', 't')]).byTask.get('t')?.showAnchorText).toBe(true)
  })
})

describe('taskName', () => {
  test('primera línea, sin markdown, cortada con …', () => {
    expect(taskName('## **Fix** the `lint`\nmore')).toBe('Fix the lint')
    const long = taskName('a'.repeat(100))
    expect(long.length).toBe(60)
    expect(long.endsWith('…')).toBe(true)
    expect(taskName('')).toBe('Task')
  })
})

describe('taskDetail', () => {
  test('omite la primera línea cuando es el nombre', () => {
    expect(taskDetail('Fix lint')).toBe('')
    expect(taskDetail('Fix lint\n\nDetails here')).toBe('Details here')
  })

  test('conserva la descripción completa cuando el nombre se trunca', () => {
    const description = `${'a'.repeat(61)}\nmore details`
    expect(taskDetail(description)).toBe(description)
  })
})

describe('buildTaskCards sin proposedTask (lanzada)', () => {
  const content = 'Plan.\n\n⏸ Created task `u-9`, waiting for your confirmation before it runs.'
  const launched = msg('1', {
    taskId: 'u-9',
    taskHeld: false,
    content,
    heldTask: { taskId: 'u-9', taskDescription: content, actionRequired: '' },
  })
  test('sin descripción conocida: vacía y el texto del orquestador se dibuja sin el id', () => {
    const card = buildTaskCards([launched]).byTask.get('u-9')
    expect(card?.description).toBe('')
    expect(card?.anchorText).toBe('Plan.')
    expect(card?.showAnchorText).toBe(true)
  })
  test('taskDescription da el nombre sin proposedTask', () => {
    const card = buildTaskCards([{ ...launched, taskDescription: 'Add the gate line' }]).byTask.get(
      'u-9',
    )
    expect(card?.description).toBe('Add the gate line')
    expect(card?.showAnchorText).toBe(true)
  })
  test('ancla taskDeleted sin reportes: sin tarjeta y mensaje visible', () => {
    const cards = buildTaskCards([{ ...launched, taskDeleted: true }])
    expect(cards.byTask.has('u-9')).toBe(false)
    expect(cards.hidden.has('1')).toBe(false)
  })
  test('taskDeleted con reportes: la tarjeta sigue', () => {
    const cards = buildTaskCards([
      { ...launched, taskDeleted: true },
      report('2', 'u-9', { outcome: 'failed' }),
    ])
    expect(cards.byTask.get('u-9')?.state).toBe('failed')
    expect(cards.hidden.has('2')).toBe(true)
  })
})
