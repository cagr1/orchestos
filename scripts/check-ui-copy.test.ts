import { describe, expect, test } from 'bun:test'
import { checkUiCopyBudget } from './check-ui-copy.ts'

const manifest = JSON.stringify([{ key: 'chat.short', context: 'fila compacta', maxChars: 10 }])

function deps(i18n: string) {
  return { readFile: (path: string) => path.endsWith('manifest.json') ? manifest : i18n }
}

describe('check-ui-copy', () => {
  test('detecta una clave que supera el presupuesto en cualquier locale', () => {
    const errors = checkUiCopyBudget(
      deps("const I18N = { en: { 'chat.short': 'This text is too long' }, es: { 'chat.short': 'Corto' } }"),
      'i18n.js',
      'manifest.json',
    )
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('en.chat.short: 21 caracteres; máximo 10')
    expect(errors[0]).toContain('title/tooltip')
  })

  test('pasa cuando ambos locales respetan el máximo', () => {
    expect(
      checkUiCopyBudget(
        deps("const I18N = { en: { 'chat.short': 'Short' }, es: { 'chat.short': 'Corto' } }"),
        'i18n.js',
        'manifest.json',
      ),
    ).toEqual([])
  })
})
