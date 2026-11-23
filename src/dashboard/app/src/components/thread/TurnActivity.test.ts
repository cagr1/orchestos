import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TurnActivity } from './TurnActivity'

test('turn activity text can be selected', () => {
  // Text steps render ThreadMarkdown, whose reduced-motion hook reads window.
  // Children exercise the selectable container without browser-only descendants.
  const html = renderToStaticMarkup(
    createElement(TurnActivity, { steps: [] }, 'Informe seleccionable'),
  )
  expect(html).toMatch(/<div class="space-y-1 select-text" data-turn-activity="">/)
  expect(html).toContain('Informe seleccionable')
})
