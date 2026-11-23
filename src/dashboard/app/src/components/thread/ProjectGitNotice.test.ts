import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProjectGitNoticeContent } from './ProjectGitNotice'

const render = (isGitRepo: boolean, hasCommits: boolean, error: string | null = null) =>
  renderToStaticMarkup(
    createElement(ProjectGitNoticeContent, {
      status: { isGitRepo, hasCommits },
      error,
      busy: false,
      initialize() {},
    }),
  )

test('offers git before a first commit, hides after success and displays the real server error', () => {
  expect(render(false, false)).toContain(
    'This folder is not a git repository. Agents need git to run tasks.',
  )
  expect(render(false, false)).toContain('Initialize git')
  expect(render(true, false)).toContain('Initialize git')
  expect(render(true, true)).not.toContain('Initialize git')
  expect(render(true, false, 'fatal: empty ident name')).toContain(
    '<div role="alert">fatal: empty ident name</div>',
  )
})

test('lists files excluded from the initial commit after success', () => {
  const html = renderToStaticMarkup(
    createElement(ProjectGitNoticeContent, {
      status: { isGitRepo: true, hasCommits: true },
      error: null,
      busy: false,
      excluded: ['.env', 'nested/private.key'],
      initialize() {},
    }),
  )
  expect(html).toContain(
    'Git initialized. Not committed (may contain secrets): .env, nested/private.key',
  )
  expect(html).not.toContain('Initialize git')
})
