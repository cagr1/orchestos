/**
 * Gate en vivo de UI.0 (Mes 30) — navegador real contra el dashboard real.
 *
 * NO es parte de la suite ni de CI, a propósito: el Mes 30 decidió no introducir
 * tests de frontend (Costo 2 del plan) y se mantiene el estándar de verificación en
 * vivo con navegador real ([[feedback-verificar-gates-en-vivo]]). Tampoco pasa por
 * `bun run gate:evidence`: ese wrapper es para gates que ejecutan tareas del harness
 * con un ORCHESTOS_HOME temporal, y esto no ejecuta ninguna.
 *
 * Playwright NO está en devDependencies (no se le agrega ~200MB a CI por un gate
 * manual). Se corre a mano:
 *
 *   bun run src/cli.ts dashboard --port 4319 &
 *   cd <un dir cualquiera> && npm i playwright && BASE=http://localhost:4319 \
 *     node <repo>/scripts/ui-gates/ui0-islands.mjs
 *
 * Qué prueba, y por qué cada cosa (los 3 primeros bloques son el criterio literal de
 * UI.0; los 3 últimos cubren el hallazgo de que `App.rerender()` borra `#main`):
 *  1. sin `?island-probe=1` el dashboard queda IDÉNTICO — cero islas, cero errores;
 *  2. los tokens shadcn resuelven a la paleta existente (`--surface`, `--border`);
 *  3. el preflight de Tailwind NO se coló (rompería las ~2.000 líneas de CSS vanilla);
 *  4. el puente de i18n repinta en vivo Y conserva el estado local de la isla
 *     (si el estado se perdiera, sería un remount, no el puente reactivo);
 *  5. tras 6 `App.rerender()` no hay islas duplicadas ni roots React leakeados;
 *  6. navegar entre pantallas no duplica ni pierde la isla.
 *
 * Última corrida verde: 2026-08-25, 16/16 PASS.
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4319'
const out = []
const log = (ok, msg) => {
  out.push(`${ok ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!ok) process.exitCode = 1
}

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(String(e)))

// ---------- 1. dashboard SIN probe: tiene que quedar idéntico ----------
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const islandsPlain = await page.locator('[data-island]').count()
log(islandsPlain === 0, `sin ?island-probe no se monta ninguna isla (encontradas: ${islandsPlain})`)
const mainHasContent = await page.locator('#main').evaluate((el) => el.innerHTML.length)
log(mainHasContent > 500, `#main renderiza el dashboard vanilla (${mainHasContent} chars)`)
const navCount = await page.locator('#sidebar *').count()
log(navCount > 0, `sidebar vanilla intacto (${navCount} elementos)`)
log(
  errors.length === 0,
  `sin errores de consola en carga normal (${errors.join(' | ') || 'ninguno'})`,
)

// ---------- 2. con probe: la isla monta ----------
errors.length = 0
await page.goto(`${BASE}/?island-probe=1`, { waitUntil: 'networkidle' })
const host = page.locator('[data-island="lang-probe"]')
await host.waitFor({ state: 'visible', timeout: 5000 })
// El host no lleva clases: las utilidades Tailwind viven en la raiz que renderiza React.
const probe = host.locator('> div')
log(true, 'la isla React monta dentro del DOM vanilla')

// ---------- 3. tokens: shadcn adoptó la paleta existente ----------
const rootBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const cardBg = await probe.evaluate((el) => getComputedStyle(el).backgroundColor)
const cardBorder = await probe.evaluate((el) => getComputedStyle(el).borderTopColor)
const varSurface = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
)
const varBorder = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue('--border').trim(),
)
const hex = (c) =>
  '#' +
  c
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => (+n).toString(16).padStart(2, '0'))
    .join('')
log(
  hex(cardBg) === varSurface.toLowerCase(),
  `bg-card resuelve a --surface (${hex(cardBg)} vs ${varSurface})`,
)
log(
  hex(cardBorder) === varBorder.toLowerCase(),
  `border-border resuelve a --border (${hex(cardBorder)} vs ${varBorder})`,
)
log(rootBg !== 'rgba(0, 0, 0, 0)', `body conserva su fondo, preflight no lo reseteó (${rootBg})`)

// ---------- 4. preflight NO se coló ----------
const h1margin = await page.evaluate(() => {
  const h = document.createElement('h1')
  h.textContent = 'x'
  document.body.appendChild(h)
  const m = getComputedStyle(h).marginTop
  h.remove()
  return m
})
log(
  h1margin !== '0px',
  `preflight de Tailwind ausente: <h1> conserva su margen de UA (${h1margin})`,
)

// ---------- 5. puente de i18n en vivo ----------
const probeText = () => probe.locator('code').nth(1).textContent()
await page.evaluate(() => window.setLang('en'))
await page.waitForTimeout(200)
const en = await probeText()
// estado local: incrementar antes de cambiar el idioma
await probe.locator('button').click()
await probe.locator('button').click()
const beforeLang = await probe.locator('button').textContent()
await page.evaluate(() => window.setLang('es'))
await page.waitForTimeout(300)
const es = await probeText()
const afterLang = await probe.locator('button').textContent()
log(
  en === 'Add task' && es === 'Agregar tarea',
  `t() repinta en vivo al cambiar idioma (en="${en}" → es="${es}")`,
)
log(
  beforeLang === afterLang && afterLang.includes('2'),
  `la isla se REPINTA, no se remonta: estado local sobrevive ("${beforeLang}" → "${afterLang}")`,
)

// ---------- 6. sobrevive a App.rerender() y no leakea ----------
const mountedAfter = async () => (await probe.locator('span').last().textContent()).match(/\d+/)[0]
const before = await mountedAfter()
await page.evaluate(() => window.App.rerender())
await page.waitForTimeout(400)
await probe.waitFor({ state: 'visible', timeout: 5000 })
const after = await mountedAfter()
log(true, 'la isla se remonta sola tras App.rerender() (que borra #main con innerHTML)')
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => window.App.rerender())
  await page.waitForTimeout(120)
}
await page.waitForTimeout(300)
const afterMany = await page.evaluate(
  () => document.querySelectorAll('[data-island="lang-probe"]').length,
)
const finalCount = await mountedAfter()
log(afterMany === 1, `sin duplicados tras 6 rerender() (contenedores: ${afterMany})`)
log(
  Number(finalCount) === 1,
  `sin leak de roots React tras 6 rerender() (montadas: ${finalCount}, antes: ${before}/${after})`,
)

// ---------- 7. navegar entre pantallas ----------
await page.evaluate(() => window.App.go('runs'))
await page.waitForTimeout(500)
await page.evaluate(() => window.App.go('chat'))
await page.waitForTimeout(500)
const afterNav = await page.evaluate(
  () => document.querySelectorAll('[data-island="lang-probe"]').length,
)
log(afterNav === 1, `navegación entre pantallas no duplica ni pierde la isla (${afterNav})`)
log(
  errors.length === 0,
  `sin errores de consola con la isla activa (${errors.join(' | ') || 'ninguno'})`,
)

await page.screenshot({ path: 'ui0-probe.png', fullPage: false })
await browser.close()
console.log(out.join('\n'))
