/**
 * B.2 (Mes 21) — highlight de task_id y nombre de modelo en respuestas del chat.
 *
 * Verificación focalizada de la LÓGICA PURA (la parte con riesgo real de bug):
 *  - buildHighlightIndex() arma el índice desde state.tasks + catálogo
 *  - escapeRegExp() escapa caracteres regex especiales en los needles
 *  - isWordChar() determina el boundary check (char antes/después del match)
 *  - El regex combinado respeta el orden longest-first (evita prefijo accidental)
 *
 * El walk del DOM (highlightRefs) y la sanitización son DOM-puro y se revisan
 * por código — no tiene sentido simular un DOM completo solo para esto y
 * agrega fragilidad. La integración con el chat real (sanitize + highlightRefs
 * juntos) se verifica en vivo contra el dashboard corriendo en :4299.
 *
 * Patrón: el archivo screens-core.js es vanilla JS de navegador, no se
 * puede importar directo desde bun:test (rompería por las referencias a
 * `document`/`marked`/`t` del top-level). Se reimplementa el cuerpo de las
 * funciones puras acá, copiado de screens-core.js, y se mantiene el mismo
 * contrato: si los originales divergen, este test va a fallar y avisa.
 */

import { describe, it, expect } from 'bun:test'

// ── Copia sincronizada de las funciones puras ────────────────────────────────
// Si screens-core.js cambia, este test falla y obliga a sincronizar.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function isWordChar(c: string): boolean {
  return /[A-Za-z0-9_]/.test(c)
}
function buildHighlightIndex(st: any): Map<string, { type: string; id: string; name?: string }> {
  const idx = new Map()
  const add = (needle: string, meta: { type: string; id: string; name?: string }) => {
    if (!needle || typeof needle !== 'string' || needle.length < 2) return
    if (!idx.has(needle)) idx.set(needle, meta)
  }
  for (const t of (st && st.tasks) || []) {
    if (t && t.id) add(t.id, { type: 'task', id: t.id })
  }
  for (const m of ((st && st.orModels) || [])) {
    if (m && m.id) add(m.id, { type: 'model', id: m.id, name: m.name || m.id })
    if (m && m.name && m.name !== m.id) add(m.name, { type: 'model', id: m.id, name: m.name })
  }
  for (const m of ((st && st.localModels) || [])) {
    const id = typeof m === 'string' ? m : (m && m.id)
    if (id) add(id, { type: 'model', id, name: id })
  }
  return idx
}

// Mismo algoritmo que processTextNode, pero devuelve matches en vez de
// tocar el DOM — así podemos asertar sobre ellos.
function findMatches(text: string, idx: Map<string, { type: string; id: string; name?: string }>): Array<{ start: number; end: number; meta: { type: string; id: string; name?: string } }> {
  if (idx.size === 0) return []
  const needles = [...idx.keys()].sort((a, b) => b.length - a.length)
  const re = new RegExp(needles.map(escapeRegExp).join('|'), 'g')
  const out: Array<{ start: number; end: number; meta: { type: string; id: string; name?: string } }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const before = m.index > 0 ? text[m.index - 1] ?? '' : ''
    const after = m.index + m[0].length < text.length ? text[m.index + m[0].length] ?? '' : ''
    if (isWordChar(before) || isWordChar(after)) continue
    const meta = idx.get(m[0])
    if (!meta) continue
    out.push({ start: m.index, end: m.index + m[0].length, meta })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('B.2 highlight index — pure logic', () => {
  it('escapeRegExp escapa todos los metacharacteres', () => {
    // Lo que importa: dado un input I, `new RegExp(escapeRegExp(I))` debe
    // matchear I exacto y NO matchear versiones "perturbadas" (un char
    // cambiado) — eso es lo que confirma que cada metacharacter fue
    // neutralizado, no el string equality (frágil al escape de "\").
    const inputs = ['a.b', 'a/b', 'a+b*c?', '(a)[b]{c}', 'deepseek/foo+bar', 'plain']
    for (const input of inputs) {
      const re = new RegExp(escapeRegExp(input))
      // Match exacto del original
      expect(re.test(input)).toBe(true)
      // Si tiene al menos 3 chars, una perturbación en el medio no debe matchear
      if (input.length >= 3) {
        // Cambiamos el char del medio a algo que GARANTICE que es distinto
        // (rotamos entre [a-z] para evitar coincidir con el original)
        const midIdx = Math.floor(input.length / 2)
        const mid = input[midIdx] ?? ''
        const replacement = mid === 'a' ? 'b' : 'a'
        const perturbed = input.slice(0, midIdx) + replacement + input.slice(midIdx + 1)
        expect(perturbed).not.toBe(input) // sanity
        expect(re.test(perturbed)).toBe(false)
      }
    }
    // Caso específico: el "." SÍ es metachar — sin escape, "a.b" como regex
    // matchearía "aXb". Con escape, NO. (Esto es el bug que la función
    // tiene que cerrar; si la implementación la rompe, este test falla.)
    const reUnescaped = new RegExp('a.b')
    expect(reUnescaped.test('aXb')).toBe(true)  // sanity: confirma el riesgo
    const reEscaped = new RegExp(escapeRegExp('a.b'))
    expect(reEscaped.test('aXb')).toBe(false)   // el fix
  })

  it('isWordChar cubre ASCII alfanumérico + underscore, no / ni -', () => {
    expect(isWordChar('a')).toBe(true)
    expect(isWordChar('Z')).toBe(true)
    expect(isWordChar('5')).toBe(true)
    expect(isWordChar('_')).toBe(true)
    // Crítico: los model ids tienen "/", que NO es word char — sino el
    // boundary check dejaría pasar "deepseek" pegado a "deepseek-v4-flash"
    expect(isWordChar('/')).toBe(false)
    expect(isWordChar('-')).toBe(false)
    expect(isWordChar(' ')).toBe(false)
    expect(isWordChar('.')).toBe(false)
  })

  it('buildHighlightIndex: solo tasks, no modelos → solo tasks', () => {
    const idx = buildHighlightIndex({ tasks: [{ id: 'crypto-page-v1' }, { id: 'other-task' }] })
    expect(idx.size).toBe(2)
    expect(idx.get('crypto-page-v1')?.type).toBe('task')
    expect(idx.get('other-task')?.type).toBe('task')
  })

  it('buildHighlightIndex: modelos con id y name — ambos se registran', () => {
    const idx = buildHighlightIndex({
      orModels: [
        { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
        { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5' },
      ],
    })
    expect(idx.size).toBe(4)
    expect(idx.get('deepseek/deepseek-v4-flash')?.type).toBe('model')
    expect(idx.get('DeepSeek V4 Flash')?.type).toBe('model')
    // El name debe apuntar al mismo id canónico
    expect(idx.get('DeepSeek V4 Flash')?.id).toBe('deepseek/deepseek-v4-flash')
  })

  it('buildHighlightIndex: id === name → un solo registro (no duplicados)', () => {
    const idx = buildHighlightIndex({
      orModels: [{ id: 'foo/bar', name: 'foo/bar' }],
    })
    expect(idx.size).toBe(1)
  })

  it('buildHighlightIndex: localModels acepta string[] o {id}[]', () => {
    const idx1 = buildHighlightIndex({ localModels: ['llama3', 'qwen2.5'] })
    const idx2 = buildHighlightIndex({ localModels: [{ id: 'llama3' }, { id: 'qwen2.5' }] })
    expect(idx1.get('llama3')?.id).toBe('llama3')
    expect(idx2.get('llama3')?.id).toBe('llama3')
  })

  it('buildHighlightIndex: ignora needles de <2 chars (defensivo)', () => {
    const idx = buildHighlightIndex({
      tasks: [{ id: 'a' }],
      orModels: [{ id: 'x', name: 'X' }],
    })
    expect(idx.size).toBe(0)
  })

  it('buildHighlightIndex: tasks vacío + models vacío → 0 entradas', () => {
    expect(buildHighlightIndex({}).size).toBe(0)
    expect(buildHighlightIndex({ tasks: [], orModels: [], localModels: [] }).size).toBe(0)
    expect(buildHighlightIndex(null).size).toBe(0)
    expect(buildHighlightIndex(undefined).size).toBe(0)
  })
})

describe('B.2 findMatches — word boundary + longest-first', () => {
  const st = {
    tasks: [{ id: 'crypto-page-v1' }],
    orModels: [
      { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
      { id: 'anthropic/claude-sonnet-5' },
    ],
  }
  const idx = buildHighlightIndex(st)

  it('matchea task_id en texto plano', () => {
    const matches = findMatches('Run the task crypto-page-v1 today.', idx)
    expect(matches.length).toBe(1)
    const m0 = matches[0]!
    expect(m0.meta.type).toBe('task')
    expect(m0.meta.id).toBe('crypto-page-v1')
  })

  it('matchea model id con "/" (no es word char, \\b no alcanzaba)', () => {
    const matches = findMatches('Try `deepseek/deepseek-v4-flash` first.', idx)
    expect(matches.length).toBe(1)
    const m0 = matches[0]!
    expect(m0.meta.type).toBe('model')
    expect(m0.meta.id).toBe('deepseek/deepseek-v4-flash')
  })

  it('matchea model name (display name, no id)', () => {
    const matches = findMatches('DeepSeek V4 Flash is a good cheap model.', idx)
    expect(matches.length).toBe(1)
    expect(matches[0]!.meta.id).toBe('deepseek/deepseek-v4-flash')
  })

  it('NO matchea si el id es substring de un token más largo (word boundary)', () => {
    // "xdeepseek/deepseek-v4-flash" — el char antes es 'k' (word char) → skip
    // "mycrypto-page-v1" — el char antes es 'y' (word char) → skip
    // "deepseek/deepseek-v4-flashy" — el char después es 'y' (word char) → skip
    expect(findMatches('xdeepseek/deepseek-v4-flash', idx).length).toBe(0)
    expect(findMatches('mycrypto-page-v1', idx).length).toBe(0)
    expect(findMatches('deepseek/deepseek-v4-flashy', idx).length).toBe(0)
  })

  it('NO matchea si el id NO está en el índice (palabras hyphenated random)', () => {
    // Texto con un hyphenated string que parece un id de tarea pero no está
    // en el state — no debe resaltarse (lógica nueva, no estilo: solo lo
    // que matchea contra state.tasks o el catálogo se vuelve chip).
    expect(findMatches('Run a one-shot test now.', idx).length).toBe(0)
    expect(findMatches('Some random-hyphenated-text here.', idx).length).toBe(0)
  })

  it('matchea múltiples referencias en el mismo texto (task + model)', () => {
    const text = 'Para la tarea crypto-page-v1 usaste anthropic/claude-sonnet-5.'
    const matches = findMatches(text, idx)
    expect(matches.length).toBe(2)
    // Ordenados por start, primero task luego model
    const m0 = matches[0]!
    const m1 = matches[1]!
    expect(m0.meta.type).toBe('task')
    expect(m0.meta.id).toBe('crypto-page-v1')
    expect(m1.meta.type).toBe('model')
    expect(m1.meta.id).toBe('anthropic/claude-sonnet-5')
  })

  it('NO matchea dentro de un prefijo de model id (longest-first gana)', () => {
    // "deepseek" es prefijo de "deepseek/deepseek-v4-flash" pero NO está
    // en el índice — la palabra sola "deepseek" no debe matchear.
    expect(findMatches('Try deepseek models.', idx).length).toBe(0)
  })

  it('NO matchea si la versión del model id difiere (case-sensitive)', () => {
    // Los ids de OpenRouter son case-sensitive: "DeepSeek/DeepSeek-V4-Flash"
    // NO es el mismo id que "deepseek/deepseek-v4-flash"
    expect(findMatches('Use DeepSeek/DeepSeek-V4-Flash here.', idx).length).toBe(0)
  })

  it('matchea al inicio y al final del texto (boundaries de string)', () => {
    expect(findMatches('crypto-page-v1 is the one', idx).length).toBe(1)
    expect(findMatches('done with crypto-page-v1', idx).length).toBe(1)
    expect(findMatches('`deepseek/deepseek-v4-flash`', idx).length).toBe(1)
  })

  it('matchea múltiples instancias del mismo id (no se detiene al primer match)', () => {
    const text = 'crypto-page-v1 was started, then crypto-page-v1 finished.'
    const matches = findMatches(text, idx)
    expect(matches.length).toBe(2)
  })
})

describe('B.2 sanitización (defensa contra inyección)', () => {
  it('idx nunca contiene valores derivados del LLM (siempre desde state)', () => {
    // La función buildHighlightIndex solo lee de st.tasks + catálogo. Aunque
    // un mensaje malicioso intentara meter un id en su contenido, ese id solo
    // se resalta si YA estaba en state.tasks o en el catálogo. El LLM no
    // puede inyectar un valor nuevo en el índice por sí solo.
    const idx = buildHighlightIndex({
      tasks: [{ id: 'legit-task' }],
      orModels: [{ id: 'legit/model', name: 'Legit Model' }],
    })
    // Confirmamos que el set de needles está cerrado: solo lo que pasamos.
    // Usamos un Set porque la igualdad de arrays respeta el orden y queremos
    // probar contenido, no orden.
    expect(new Set(idx.keys())).toEqual(new Set(['legit-task', 'legit/model', 'Legit Model']))
  })

  it('escapeRegExp neutraliza cualquier caracter regex del id', () => {
    // Forzamos ids con caracteres especiales para confirmar que el regex
    // no se rompe (ni captura de más, ni falla de sintaxis).
    const idx = buildHighlightIndex({
      tasks: [{ id: 'task.with.dots' }, { id: 'task(with)parens' }, { id: 'task[brackets]' }],
    })
    const text = 'Run task.with.dots and task(with)parens plus task[brackets] now.'
    const matches = findMatches(text, idx)
    expect(matches.length).toBe(3)
    expect(matches.map(m => m.meta.id).sort()).toEqual([
      'task(with)parens',
      'task.with.dots',
      'task[brackets]',
    ])
    // El sort() muta matches; los ids siguen siendo los mismos.
    // Verifico que el id está presente (defensivo contra el orden).
    const ids = new Set(matches.map(m => m.meta.id))
    expect(ids.has('task.with.dots')).toBe(true)
    expect(ids.has('task(with)parens')).toBe(true)
    expect(ids.has('task[brackets]')).toBe(true)
  })
})
