import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CutReport } from '../../../../cut-check'
import { CutReportCard, cutContinuation } from './CutReportCard'

const clean: CutReport = {
  baseHead: 'base-head',
  dirty: [],
  dirtyTotal: 0,
  branch: 'main',
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  lock: 'released',
  handoff: 'next-md',
}
const render = (report: CutReport) =>
  renderToStaticMarkup(createElement(CutReportCard, { report, onContinue() {} }))

test('cut card shows the clean, pushed result and continuation', () => {
  const html = render(clean)
  for (const text of [
    'Session wrapped up',
    'Working tree clean',
    'Pushed to origin/main',
    'Writer lock released',
    'Handoff in NEXT.md',
    'Continue in new session',
  ])
    expect(html).toContain(text)
})

test('incomplete cut shows dirty paths, missing push and held lock', () => {
  const html = render({
    ...clean,
    dirty: ['a.txt'],
    dirtyTotal: 21,
    ahead: 2,
    lock: 'held',
    handoff: 'Next steps',
  })
  for (const text of [
    'Wrap-up incomplete',
    '21 uncommitted files',
    '<details>',
    'a.txt',
    '2 commits not pushed',
    'Writer lock kept: uncommitted changes',
    'Handoff in the last reply',
  ])
    expect(html).toContain(text)
  const noUpstream = render({ ...clean, upstream: null, ahead: null, lock: 'none', handoff: null })
  expect(noUpstream).toContain('Wrap-up incomplete')
  expect(noUpstream).toContain('No upstream branch')
  expect(noUpstream).toContain('No handoff found')
  expect(noUpstream).not.toContain('Writer lock')
  expect(render({ ...clean, lock: 'held-by-other' })).toContain(
    'Writer lock held by another session',
  )
})

test('continuation messages preserve handoff text and real newlines', () => {
  expect(cutContinuation('next-md')).toBe('Continue. Start from NEXT.md.')
  expect(cutContinuation('Next steps')).toBe('Continue from this handoff:\n\nNext steps')
  expect(cutContinuation(null)).toBe('Continue.')
})

test('a failed check cannot show a successful wrap-up even with clean git counts', () => {
  const html = render({ ...clean, checkFailed: true })
  expect(html).toContain('Wrap-up incomplete')
  expect(html).not.toContain('Session wrapped up')
})

test('superseded reports remain visible but dimmed without a continuation button', () => {
  const html = renderToStaticMarkup(
    createElement(CutReportCard, {
      report: clean,
      onContinue() {},
      superseded: true,
    }),
  )
  expect(html).toContain('Session wrapped up')
  expect(html.split('>')[0]).toContain('opacity-50')
  expect(html).not.toContain('Continue in new session')
  expect(html).not.toContain('<button')
  expect(render(clean).split('>')[0]).not.toContain('opacity-50')
})
