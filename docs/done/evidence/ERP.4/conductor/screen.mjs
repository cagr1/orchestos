import { createRequire } from 'node:module'

const require = createRequire('/Users/carlosgallardo/Projects/projects/orchestos/package.json')
const { chromium } = require('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
const rows = async () =>
  (await page.locator('tbody tr').allInnerTexts()).map((r) => r.replace(/\s+/g, ' '))
const move = async (tipo, cantidad, rol) => {
  await page.getByLabel('Tipo').selectOption(tipo)
  await page.getByLabel('Cantidad').fill(String(cantidad))
  await page.getByLabel('Rol').selectOption(rol)
  const resp = page.waitForResponse((r) => r.url().endsWith('/movimientos'))
  await page.getByRole('button', { name: 'Registrar movimiento' }).click()
  const status = (await resp).status()
  await page.waitForTimeout(600)
  return {
    tipo,
    cantidad,
    rol,
    status,
    mensaje: await page
      .getByRole('status')
      .innerText()
      .catch(() => null),
    filas: await rows(),
  }
}
const out = { inicio: await rows(), pasos: [] }
out.pasos.push(await move('entrada', 5, 'operador'))
out.pasos.push(await move('salida', 2, 'operador'))
out.pasos.push(await move('salida', 99, 'admin'))
out.pasos.push(await move('salida', 2, 'admin'))
await page.screenshot({ path: '/tmp/erp4/shots/pantalla-erp.png' })
out.errores = errors
console.log(JSON.stringify(out, null, 1))
await browser.close()
