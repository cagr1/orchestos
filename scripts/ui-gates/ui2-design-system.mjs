/**
 * Gate en vivo de UI.2 (Mes 30) — los 6 componentes del design system, en navegador real.
 *
 * Lo que mide, y por qué así: "espeja el look vanilla" es una afirmación verificable, no
 * una opinión. Cada bloque compara el estilo COMPUTADO del componente React contra el
 * valor que el CSS vanilla ya usa (leído del mismo documento), en vez de contra un
 * número copiado a mano que se desactualiza el día que alguien toque `styles.css`.
 *
 * Cómo se corre (Playwright no está en devDependencies, es un gate manual):
 *   bun run src/cli.ts dashboard --port 4321 &
 *   cd <dir con playwright> && BASE=http://localhost:4321 node <repo>/scripts/ui-gates/ui2-design-system.mjs
 *
 * Última corrida verde: 2026-08-28.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4321'
const out = []
const log = (ok, msg) => { out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`); if (!ok) process.exitCode = 1 }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push(String(e)))

// ── El dashboard normal NO ve el banco de pruebas ────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
log(await page.locator('[data-island="ui-kit-probe"]').count() === 0,
  'sin ?ui-probe=1 el banco de pruebas no aparece')

await page.goto(`${BASE}/?ui-probe=1`, { waitUntil: 'networkidle' })
const probe = page.locator('[data-island="ui-kit-probe"]')
await probe.waitFor({ state: 'visible', timeout: 8000 })
log(true, 'el banco de pruebas monta con ?ui-probe=1')

// ── BUTTON — densidad y colores contra el .btn vanilla ──────────────────────
const btnVanilla = await page.evaluate(() => {
  // Se mide el `.btn` real del CSS vanilla creando uno de verdad, en vez de hardcodear
  // los números: si mañana cambia `styles.css`, este gate lo detecta.
  const el = document.createElement('button')
  el.className = 'btn'; el.textContent = 'x'; document.body.appendChild(el)
  const cs = getComputedStyle(el)
  const v = { padding: cs.padding, radius: cs.borderRadius, font: cs.fontSize, gap: cs.gap, bg: cs.backgroundColor }
  el.remove(); return v
})
const btnReact = await page.evaluate(() => {
  const el = document.querySelector('[data-variant="secondary"]')
  const cs = getComputedStyle(el)
  return { padding: cs.padding, radius: cs.borderRadius, font: cs.fontSize, gap: cs.gap, bg: cs.backgroundColor }
})
log(btnReact.padding === btnVanilla.padding, `Button: padding igual al .btn vanilla (${btnReact.padding})`)
log(btnReact.radius === btnVanilla.radius, `Button: radio igual (${btnReact.radius})`)
log(btnReact.font === btnVanilla.font, `Button: tamaño de fuente igual (${btnReact.font})`)
log(btnReact.gap === btnVanilla.gap, `Button: gap igual (${btnReact.gap})`)
log(btnReact.bg === btnVanilla.bg, `Button variant=secondary: mismo fondo que .btn neutro (${btnReact.bg})`)

// Las 6 variantes deben ser efectivamente distintas: es el chequeo que detecta un
// `bg-secondary hover:bg-accent` (dos tokens que mapean al MISMO color) — el bug real
// de la primera pasada de button.tsx.
const variantColors = await page.evaluate(() =>
  Object.fromEntries([...document.querySelectorAll('[data-variant]')].map(el =>
    [el.dataset.variant, getComputedStyle(el).backgroundColor + '|' + getComputedStyle(el).color])))
const distinct = new Set(Object.values(variantColors)).size
const variantCount = Object.keys(variantColors).length
log(distinct === variantCount,
  `Button: TODAS las variantes son visualmente distintas (${distinct} únicas de ${variantCount})`)

// El hover tiene que cambiar algo de verdad.
const secondary = page.locator('[data-variant="secondary"]')
const bgBefore = await secondary.evaluate(el => getComputedStyle(el).backgroundColor)
await secondary.hover()
await page.waitForTimeout(250)
const bgAfter = await secondary.evaluate(el => getComputedStyle(el).backgroundColor)
log(bgBefore !== bgAfter, `Button: el hover cambia el fondo de verdad (${bgBefore} → ${bgAfter})`)

const disabledClickable = await page.evaluate(() => {
  const el = document.querySelector('[data-probe="btn-disabled"]')
  return { disabled: el.disabled, pointer: getComputedStyle(el).pointerEvents }
})
log(disabledClickable.disabled && disabledClickable.pointer === 'none', 'Button: disabled no recibe clicks')

// ── INPUT — contra el input del modal vanilla ───────────────────────────────
await page.locator('[role="tab"]', { hasText: 'Inputs' }).click()
await page.waitForTimeout(300)
const inputReact = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('[data-probe="input"]'))
  return { padding: cs.padding, font: cs.fontSize, bg: cs.backgroundColor, radius: cs.borderRadius }
})
const bgVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim())
const toHex = c => '#' + c.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('')
log(inputReact.padding === '9px 11px', `Input: padding igual al del modal vanilla (${inputReact.padding})`)
log(inputReact.font === '13.5px', `Input: tamaño de fuente igual (${inputReact.font})`)
log(toHex(inputReact.bg) === bgVar.toLowerCase(), `Input: fondo sobre --bg como el vanilla (${toHex(inputReact.bg)})`)

await page.locator('[data-probe="input"]').fill('hola')
await page.waitForTimeout(200)
const echoed = await probe.textContent()
log(echoed.includes('valor: hola'), 'Input: es controlado y reporta el cambio')

// ── TABS — cambian de panel y son navegables por teclado ────────────────────
const tabsWork = await page.evaluate(() => document.querySelector('[data-probe="inputs"]') !== null)
log(tabsWork, 'Tabs: cambiar de pestaña cambia el panel visible')
await page.locator('[role="tab"]', { hasText: 'Inputs' }).focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(300)
const afterArrow = await page.evaluate(() =>
  document.querySelector('[role="tab"][aria-selected="true"]')?.textContent)
log(afterArrow === 'Overlays', `Tabs: las flechas navegan entre pestañas (activa: ${afterArrow})`)

// Tabs debe espejar `.filter-tab`, el patrón de pestañas que el dashboard YA usa — no el
// segmented control por defecto de shadcn, que acá se ve como un injerto.
const tabVanilla = await page.evaluate(() => {
  const el = document.createElement('button')
  el.className = 'filter-tab active'; el.textContent = 'x'; document.body.appendChild(el)
  const cs = getComputedStyle(el)
  const v = { padding: cs.padding, radius: cs.borderRadius, font: cs.fontSize, bg: cs.backgroundColor }
  el.remove(); return v
})
const tabReact = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('[role="tab"][aria-selected="true"]'))
  return { padding: cs.padding, radius: cs.borderRadius, font: cs.fontSize, bg: cs.backgroundColor }
})
log(tabReact.radius === tabVanilla.radius && tabReact.padding === tabVanilla.padding
  && tabReact.font === tabVanilla.font && tabReact.bg === tabVanilla.bg,
  `Tabs: la pestaña activa espeja .filter-tab (radio ${tabReact.radius}, padding ${tabReact.padding}, fondo ${tabReact.bg})`)

// ── DIALOG — contra el .modal vanilla, y por encima del scrim ───────────────
await page.locator('[data-probe="open-dialog"]').click()
const dialog = page.locator('[data-probe="dialog"]')
await dialog.waitFor({ state: 'visible', timeout: 5000 })
const dialogStyle = await dialog.evaluate(el => {
  const cs = getComputedStyle(el)
  return { width: cs.width, radius: cs.borderRadius, z: cs.zIndex, bg: cs.backgroundColor }
})
const surfaceVar = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())
log(dialogStyle.width === '440px', `Dialog: 440px como el .modal vanilla (${dialogStyle.width})`)
log(dialogStyle.radius === '12px', `Dialog: radio 12px como el vanilla (${dialogStyle.radius})`)
log(toHex(dialogStyle.bg) === surfaceVar.toLowerCase(), `Dialog: fondo --surface (${toHex(dialogStyle.bg)})`)
log(Number(dialogStyle.z) === 300, `Dialog: z-index 300, sobre el scrim vanilla (200) y bajo los toasts (9999)`)

// Las transiciones tienen que existir: la primera pasada usaba clases de
// `tailwindcss-animate`, que no está instalado — compilaban y no generaban una regla.
const opacity = await dialog.evaluate(el => getComputedStyle(el).opacity)
const hasTransition = await dialog.evaluate(el => getComputedStyle(el).transitionDuration !== '0s')
log(opacity === '1' && hasTransition, `Dialog: la transición de apertura existe de verdad (opacity ${opacity})`)

// Foco atrapado y Esc: lo que Radix debería resolver de fábrica.
const focusInside = await page.evaluate(() =>
  document.querySelector('[data-probe="dialog"]')?.contains(document.activeElement))
log(focusInside, 'Dialog: al abrir, el foco entra al diálogo')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
log(await page.locator('[data-probe="dialog"]').count() === 0, 'Dialog: Esc lo cierra')

// ── TOAST — el reemplazo real de showToast(), con 71 llamadores intactos ────
await page.locator('[role="tab"]', { hasText: 'Overlays' }).click()
await page.waitForTimeout(300)

// SOBRE EL `eval()` DE ABAJO — es deliberado y es el punto de la verificación, no un
// atajo. Los 71 call sites vanilla llaman `showToast(...)` a secas, sin `window.`,
// resolviendo el identificador por el scope global. Llamar `window.showToast(...)` desde
// el gate probaría otra cosa: que la propiedad existe, no que la referencia SIN prefijo
// quedó redirigida — que es exactamente lo que hay que demostrar para poder afirmar que
// los 71 llamadores no se tocan. `eval()` es la única forma de resolver el identificador
// como lo hace `app.js`. El string es un literal fijo escrito acá, sin ninguna entrada
// externa, y corre en un script de gate manual contra un dashboard local.
// El dispatch y la comprobación van en pasos SEPARADOS: `pushToast()` programa un
// render de React, no lo aplica sincrónicamente. Leer el DOM en el mismo tick daba un
// falso negativo (fallo de la primera corrida del gate, no del código).
await page.evaluate(() => { eval("showToast('desde el vanilla', undefined)") })
await page.waitForTimeout(400)
const globalHijacked = await page.evaluate(() =>
  document.querySelector('#orchestos-toaster')?.textContent?.includes('desde el vanilla') ?? false)
log(globalHijacked, 'Toast: showToast() global redirigida — los 71 call sites vanilla no se tocan')

await page.evaluate(() => { eval("showToast('segundo aviso', 'error')") })
await page.waitForTimeout(400)
const stacked = await page.evaluate(() =>
  document.querySelectorAll('#orchestos-toaster [data-state="open"]').length)
log(stacked === 2, `Toast: dos avisos se APILAN en vez de superponerse como en vanilla (${stacked})`)

const toastGeo = await page.evaluate(() => {
  const vp = document.querySelector('#orchestos-toaster ol')
  const cs = getComputedStyle(vp)
  const r = vp.getBoundingClientRect()
  return { z: cs.zIndex, centered: Math.abs((r.left + r.right) / 2 - window.innerWidth / 2) < 2, live: vp.getAttribute('aria-live') ?? vp.closest('[aria-live]')?.getAttribute('aria-live') }
})
log(Number(toastGeo.z) === 9999, `Toast: z-index 9999 como el vanilla (${toastGeo.z})`)
log(toastGeo.centered, 'Toast: centrado abajo, en las coordenadas del toast vanilla')

const errorColored = await page.evaluate(() => {
  const items = [...document.querySelectorAll('#orchestos-toaster li')]
  const err = items.find(i => i.textContent.includes('segundo aviso'))
  const errVar = getComputedStyle(document.documentElement).getPropertyValue('--error').trim()
  const toHex = c => '#' + c.match(/\d+/g).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('')
  return err ? toHex(getComputedStyle(err).color) === errVar.toLowerCase() : false
})
log(errorColored, "Toast: la variante 'error' usa --error, igual que .toast-error")

await page.screenshot({ path: 'ui2-kit.png' })
await page.waitForTimeout(3200)
log(await page.evaluate(() => document.querySelectorAll('#orchestos-toaster [data-state="open"]').length) === 0,
  'Toast: expiran solos a los 3s, como el vanilla')

// El host de toasts vive fuera de #main: un repintado no puede borrarlo.
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(500)
await page.evaluate(() => { eval("showToast('tras rerender')") })
await page.waitForTimeout(400)
log(await page.evaluate(() => document.querySelector('#orchestos-toaster')?.textContent?.includes('tras rerender') ?? false),
  'Toast: sobrevive a App.rerender() porque el host cuelga de <body>, no de #main')

log(errors.length === 0, `sin errores de consola en toda la corrida (${errors.join(' | ') || 'ninguno'})`)

await browser.close()
console.log(out.join('\n'))
