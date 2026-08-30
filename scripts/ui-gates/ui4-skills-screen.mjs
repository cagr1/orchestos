/**
 * Gate en vivo de UI.4 — pantalla Skills (Mes 30), la segunda pantalla migrada.
 *
 * Escrito por Claude MIENTRAS Codex implementaba la pantalla, sin ver su código — el mismo
 * reparto que se usó en UI.3 pero con los roles invertidos (allá Codex escribió el gate y
 * Claude el componente). El punto es el mismo: el que mide no es el que construye.
 *
 * Skills es distinta de Specs en algo que importa: NO usa tabla, usa un layout de cards, y
 * tiene una confirmación de borrado INLINE (un panel dentro de la card, no un modal) más una
 * segunda sección con las skills "pro" importables. O sea que ejercita partes del patrón que
 * Specs no tocó.
 *
 * PARIDAD VISUAL: se compara el estilo computado de Skills (React) contra pantallas que
 * siguen 100% en vanilla, usando los elementos que comparten — título y botones contra Runs,
 * y los badges contra Tasks (Runs solo tiene `.badge` pill, y acá hacen falta `.badge.square`).
 * No se pueden comparar las cards porque ninguna vanilla las tiene; se miden los elementos
 * comunes, que son los que revelarían un cambio de tipografía o de densidad.
 *
 *   bun run src/cli.ts dashboard --port 4325 &
 *   cd <dir con playwright> && BASE=http://localhost:4325 node <repo>/scripts/ui-gates/ui4-skills-screen.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4325'
const out = []
const log = (ok, msg) => { out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`); if (!ok) process.exitCode = 1 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
const isExpected404 = (text) => /Failed to load resource.*404/.test(text)
page.on('console', m => { if (m.type() === 'error' && !isExpected404(m.text())) errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// Se siembra estado para no depender de qué skills tenga la instalación local, y para poder
// forzar el caso de la skill "pro" ya importada (que renderiza un botón deshabilitado).
const seed = () => page.evaluate(() => {
  window.state.skills = [
    { id: 'skill-alfa', name: 'Skill Alfa', description: 'primera skill sembrada', targets: ['claude', 'codex'] },
    { id: 'skill-beta', name: 'Skill Beta', description: 'segunda skill sembrada', targets: ['claude'] },
  ]
  window.state.proSkills = [
    { id: 'pro-uno', name: 'Pro Uno', description: 'pro sin importar', targets: ['claude'], imported: false },
    { id: 'pro-dos', name: 'Pro Dos', description: 'pro ya importada', targets: ['codex'], imported: true },
  ]
  window.state.skillsStatus = 'ok'
  window.App.go('skills')
})
await seed()
await page.waitForTimeout(900)

// ── Montaje y estructura ────────────────────────────────────────────────────
log(await page.locator('[data-island="screen-skills"]').count() === 1,
  'la pantalla monta como una sola isla React')
const cards = await page.locator('.skill-card').count()
log(cards === 4, `renderiza las 2 skills propias + las 2 pro (${cards} cards)`)
log(await page.locator('.screen-head h1').count() >= 1, 'conserva el encabezado de la pantalla')

const tools = await page.locator('.screen-head .tools .btn').allTextContents()
log(tools.length >= 4,
  `conserva sus 4 acciones de cabecera: refresh/nueva/importar/descubrir (${tools.map(s => s.trim()).join(' · ')})`)

// Los targets de cada skill salen como badges azules, igual que en vanilla.
const targetBadges = await page.locator('.skill-card-targets .badge').count()
log(targetBadges === 5, `los targets salen como badges (${targetBadges}: 2+1 propias, 1+1 pro)`)

// ── Sección "pro" — el caso que Specs no tenía ──────────────────────────────
log(await page.locator('.skills-pro-section').count() === 1, 'la sección de skills pro está presente')
const proImportedDisabled = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('[data-pro-skill]')]
  const dos = cards.find(c => c.textContent.includes('Pro Dos'))
  const uno = cards.find(c => c.textContent.includes('Pro Uno'))
  return {
    importadaDeshabilitada: !!dos?.querySelector('button[disabled]'),
    sinImportarHabilitada: !!uno?.querySelector('button:not([disabled])'),
  }
})
log(proImportedDisabled.importadaDeshabilitada && proImportedDisabled.sinImportarHabilitada,
  'una skill pro ya importada muestra su botón deshabilitado y la no importada, habilitado')

// ── Confirmación de borrado INLINE — el otro caso propio de esta pantalla ───
// En vanilla el panel existe siempre en el DOM con `display:none` y se muestra al pedir
// borrar. Lo que importa no es CÓMO se oculte (React puede no renderizarlo), sino que borrar
// pida confirmación en la card y no en un modal.
const beforeConfirm = await page.locator('.skill-card-confirm:visible').count()
log(beforeConfirm === 0, 'la confirmación de borrado no se ve hasta pedirla')
await page.locator('.skill-card').first().locator('button', { hasText: /Delet|Borrar|Elimin/i }).first().click()
await page.waitForTimeout(400)
const afterConfirm = await page.locator('.skill-card-confirm:visible').count()
log(afterConfirm === 1, 'pedir borrar muestra la confirmación INLINE en la card, no un modal')
const modalOpen = await page.locator('.modal-scrim.show').count()
log(modalOpen === 0, 'y no abre ningún modal — es el comportamiento del vanilla')

// Cancelar la vuelve a ocultar, sin borrar nada.
await page.locator('.skill-card-confirm:visible button', { hasText: /Cancel/i }).first().click()
await page.waitForTimeout(400)
log(await page.locator('.skill-card-confirm:visible').count() === 0, 'cancelar oculta la confirmación')
log(await page.locator('.skill-card').count() === 4, 'y no borró nada')

// ── La isla NO se remonta en cada repintado (el flag `react: true`) ─────────
await page.evaluate(() => {
  document.querySelector('[data-island="screen-skills"]').dataset.gateMark = 'vivo'
})
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(600)
log(await page.evaluate(() => document.querySelector('[data-island="screen-skills"]')?.dataset.gateMark) === 'vivo',
  'App.rerender() NO destruye el DOM de la pantalla (el nodo es el mismo)')
log(await page.locator('[data-island="screen-skills"]').count() === 1, 'sin islas duplicadas tras el repintado')

// Y el repintado sí refleja datos nuevos.
await page.evaluate(() => {
  window.state.skills = [...window.state.skills, {
    id: 'skill-gamma', name: 'Skill Gamma', description: 'agregada por el gate', targets: ['claude'],
  }]
  window.App.rerender()
})
await page.waitForTimeout(500)
log(await page.locator('.skill-card').count() === 5,
  'un dato nuevo en el estado aparece tras rerender() — el aviso a React funciona')

// ── Estados de carga / error / vacío ────────────────────────────────────────
for (const [status, selector, label] of [
  ['loading', '.placeholder .spinner', 'carga'],
  ['error', '.placeholder.err', 'error'],
]) {
  await page.evaluate((s) => { window.state.skillsStatus = s; window.App.rerender() }, status)
  await page.waitForTimeout(500)
  log(await page.locator(selector).count() === 1, `el estado de ${label} se renderiza igual que en vanilla`)
}
await page.evaluate(() => { window.state.skillsStatus = 'ok'; window.state.skills = []; window.App.rerender() })
await page.waitForTimeout(500)
log(await page.locator('.placeholder').count() >= 1, 'el estado vacío se renderiza')

// ── Paridad visual contra Runs, que sigue en vanilla ────────────────────────
await seed()
await page.waitForTimeout(700)
const styleOf = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s)
  if (!el) return null
  const cs = getComputedStyle(el)
  return { pad: cs.padding, font: cs.fontSize, radius: cs.borderRadius, color: cs.color }
}, sel)
const reactH1 = await styleOf('.screen-head h1')
const reactBtn = await styleOf('.screen-head .tools .btn')
// `.badge.square` en LOS DOS lados: `.badge` a secas es un pill (999px) y `.badge.square`
// tiene 5px, así que comparar un `.badge` cualquiera de cada pantalla medía tipos distintos
// y daba un falso negativo — fallo de la primera versión de este gate, no del componente.
const reactBadge = await styleOf('.badge.square')
await page.evaluate(() => { localStorage.setItem('orchestos-mode', 'advanced'); window.App.go('runs') })
await page.waitForTimeout(1400)
const vanillaH1 = await styleOf('.screen-head h1')
const vanillaBtn = await styleOf('.screen-head .tools .btn')
// El badge NO se compara contra un badge de otra pantalla, sino contra uno CREADO al vuelo
// con las mismas clases (la técnica del gate de UI.2). Dos intentos previos fallaron por el
// mismo motivo de fondo — el elemento de referencia no era equivalente: en Runs los badges son
// `.badge` a secas (pill, 999px), y en Tasks el primero que aparece lleva un
// `style="font-size:9.5px"` INLINE propio de esa fila. Un elemento limpio mide el estilo base
// de la clase, que es lo único que la migración podría haber cambiado.
const vanillaBadge = await page.evaluate(() => {
  const el = document.createElement('span')
  el.className = 'badge blue square'; el.textContent = 'x'; document.body.appendChild(el)
  const cs = getComputedStyle(el)
  const v = { pad: cs.padding, font: cs.fontSize, radius: cs.borderRadius, color: cs.color }
  el.remove(); return v
})
log(reactH1 && vanillaH1 && reactH1.font === vanillaH1.font && reactH1.color === vanillaH1.color,
  `paridad del título contra Runs (React ${reactH1?.font} vs vanilla ${vanillaH1?.font})`)
log(reactBtn && vanillaBtn && reactBtn.pad === vanillaBtn.pad && reactBtn.font === vanillaBtn.font,
  `paridad de los botones de cabecera (React ${reactBtn?.pad} vs vanilla ${vanillaBtn?.pad})`)
log(reactBadge && vanillaBadge && reactBadge.font === vanillaBadge.font && reactBadge.radius === vanillaBadge.radius,
  `paridad de los badges (React ${reactBadge?.font}/${reactBadge?.radius} vs vanilla ${vanillaBadge?.font}/${vanillaBadge?.radius})`)

log(errors.length === 0,
  `sin errores de consola ni excepciones: ${errors.join(' | ') || 'ninguno'}`)

await page.evaluate(() => window.App.go('skills'))
await page.waitForTimeout(800)
await page.screenshot({ path: 'ui4-skills.png' })
await browser.close()
console.log(out.join('\n'))
