/**
 * TRINQUETE de aislamiento de DB (2026-09-11).
 *
 * La fuga de fixtures de test a la DB real es un patrón RECURRENTE: se cerró en
 * IDEAS.md #20 (2026-07-05) auditando 8 archivos y purgando 1800 filas, y volvió
 * en Mes 18/I.6 sobre una tabla que esa auditoría no había mirado.
 *
 * Auditar test por test no lo previene, porque cada tabla nueva reabre el
 * agujero. Lo único que lo previene es que la suite no pueda escribir en la DB
 * real AUNQUE un test se olvide de su `afterAll`. Este archivo es el diente que
 * lo hace cumplir: si alguien borra el preload de `bunfig.toml`, cambia el orden
 * de `test-preload.ts` o convierte su import dinámico en estático, estos tests
 * fallan y CI se pone rojo — en vez de ensuciarse la DB de Carlos en silencio.
 *
 * No verifica una regla escrita: verifica el estado real contra el que corre la
 * suite en este proceso.
 */
import { describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DB_PATH } from '../src/db/sqlite.ts'

describe('aislamiento de la DB de tests', () => {
  test('ORCHESTOS_HOME está definido durante la suite', () => {
    expect(process.env.ORCHESTOS_HOME).toBeTruthy()
  })

  test('la suite NO corre contra la DB real del usuario', () => {
    const real = join(homedir(), '.orchestos', 'db.sqlite')
    expect(DB_PATH).not.toBe(real)
  })

  test('la DB activa vive bajo el home temporal declarado, no bajo $HOME', () => {
    expect(DB_PATH.startsWith(process.env.ORCHESTOS_HOME as string)).toBe(true)
    expect(DB_PATH.startsWith(join(homedir(), '.orchestos'))).toBe(false)
  })
})
