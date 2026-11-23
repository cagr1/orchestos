import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { CliModelCatalog } from '../../api/chat'
import type { ExecutorMode } from '../../api/settings'
import { AgentLaunchOption } from './AgentLauncher'
import { buildLaunchOptions, filterLaunchOptions, nextLaunchIndex } from './agent-launcher'

const modes: ExecutorMode[] = [
  { id: 'absent', label: 'Absent agent', detected: false, path: null, session: 'chat' },
  { id: 'setup', label: 'Needs setup', detected: true, path: '/fixture/setup', session: 'chat' },
  { id: 'custom', label: 'Custom Agent', detected: true, path: '/fixture/custom', session: 'chat' },
  {
    id: 'terminal',
    label: 'Terminal Agent',
    detected: true,
    path: '/fixture/terminal',
    session: 'terminal',
  },
  { id: 'no-session', detected: true, path: '/fixture/no-session', session: null },
]
const catalogs: CliModelCatalog[] = [
  { id: 'setup', models: [], efforts: [], functional: false, chat: true },
  { id: 'custom', models: [], efforts: [], functional: true, chat: true },
  { id: 'terminal', models: [], efforts: [], functional: true, terminal: true },
]
const options = buildLaunchOptions(modes, catalogs)

test('launch states come from discovery and health; modes without sessions are excluded', () => {
  expect(options.map(({ id, state, label }) => ({ id, state, label }))).toEqual([
    { id: 'absent', state: 'not-installed', label: 'Absent agent' },
    { id: 'setup', state: 'setup-required', label: 'Needs setup' },
    { id: 'custom', state: 'ready', label: 'Custom Agent' },
    { id: 'terminal', state: 'ready', label: 'Terminal Agent' },
  ])
  expect(buildLaunchOptions(modes, catalogs, 'terminal').map((option) => option.id)).toEqual([
    'terminal',
    'absent',
    'setup',
    'custom',
  ])
  expect(buildLaunchOptions(modes, [], 'unknown').map((option) => option.state)).toEqual([
    'not-installed',
    'ready',
    'ready',
    'ready',
  ])
})

test('filter matches name and id regardless of case and empty query preserves all', () => {
  expect(filterLaunchOptions(options, 'CUSTOM AGENT').map((option) => option.id)).toEqual([
    'custom',
  ])
  expect(filterLaunchOptions(options, 'SETUP').map((option) => option.id)).toEqual(['setup'])
  expect(filterLaunchOptions(options, '')).toEqual(options)
  expect(filterLaunchOptions(options, 'missing')).toEqual([])
})

test('arrow navigation skips disabled rows and wraps in both directions', () => {
  expect(nextLaunchIndex(options, -1, 1)).toBe(2)
  expect(nextLaunchIndex(options, 2, 1)).toBe(3)
  expect(nextLaunchIndex(options, 3, 1)).toBe(2)
  expect(nextLaunchIndex(options, 2, -1)).toBe(3)
  expect(nextLaunchIndex(options, 3, -1)).toBe(2)
  expect(nextLaunchIndex(options.slice(0, 2), 0, 1)).toBe(-1)
  expect(nextLaunchIndex(options.slice(0, 2), 0, -1)).toBe(-1)
  expect(nextLaunchIndex([], -1, 1)).toBe(-1)
})

test('disabled row markup identifies unavailable agents and uses only theme tokens', () => {
  const markup = renderToStaticMarkup(
    createElement(AgentLaunchOption, {
      option: options[0],
      active: false,
      id: 'fixture-option',
      onChoose: () => {},
    }),
  )
  expect(markup).toContain('role="option"')
  expect(markup).toContain('aria-disabled="true"')
  expect(markup).toContain('Not installed')
  expect(markup).not.toMatch(/zinc-|black|white|#/)
  const setup = renderToStaticMarkup(
    createElement(AgentLaunchOption, {
      option: options[1],
      active: false,
      id: 'fixture-setup',
      onChoose: () => {},
    }),
  )
  expect(setup).toContain('Setup required')
})
