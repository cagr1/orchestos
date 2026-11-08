import { expect, test } from 'bun:test'
import { numberedDiffLines, splitDiffRows } from './DevDiffPanel'
import { type OpenPathRequest, openFileTab, openPathTab } from './file-tabs'
import { DiffFileButton } from './OrcaRightInspector'
import { emptySessionTabs, persistedDevTabs, restoreSessionTabs } from './session-tabs'

test('Diff list click previews and double click pins through the opener', () => {
  const requests: OpenPathRequest[] = []
  const button = DiffFileButton({
    path: 'src/main.ts',
    selected: true,
    onOpen: (request) => requests.push(request),
  })
  button.props.onClick()
  button.props.onDoubleClick()
  expect(requests).toEqual([
    { kind: 'diff', path: 'src/main.ts', pin: false },
    { kind: 'diff', path: 'src/main.ts', pin: true },
  ])
  expect(button.props['aria-pressed']).toBe(true)
})

test('diff and file of the same path coexist; only the preview is replaced', () => {
  const file = openFileTab(emptySessionTabs(), 'a.ts', true)
  const preview = openPathTab(file, { kind: 'diff', path: 'a.ts', pin: false })
  expect(preview.tabs.map((tab) => tab.id)).toEqual(['file:a.ts', 'diff:a.ts'])
  expect(openFileTab(preview, 'b.ts').tabs.map((tab) => tab.id)).toEqual(['file:a.ts', 'file:b.ts'])
  const fixed = openPathTab(preview, { kind: 'diff', path: 'a.ts', pin: true })
  expect(openPathTab(fixed, { kind: 'diff', path: 'a.ts', pin: false })).toEqual(fixed)
  expect(restoreSessionTabs(persistedDevTabs(fixed), [], undefined, ['a.ts'])).toEqual(fixed)
  expect(persistedDevTabs(preview)).toEqual(file)
  const deleted = openPathTab(emptySessionTabs(), { kind: 'diff', path: 'gone.ts', pin: true })
  expect(restoreSessionTabs(persistedDevTabs(deleted), [], undefined, [])).toEqual(deleted)
})

test('diff line numbers follow both sides and reset at each hunk', () => {
  expect(
    numberedDiffLines(
      'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -2,2 +2,3 @@\n context\n-old\n+new\n+extra\n\\ No newline at end of file\n@@ -10 +11 @@\n-last\n+next\n',
    ),
  ).toEqual([
    { text: '@@ -2,2 +2,3 @@', oldLine: null, newLine: null },
    { text: ' context', oldLine: 2, newLine: 2 },
    { text: '-old', oldLine: 3, newLine: null },
    { text: '+new', oldLine: null, newLine: 3 },
    { text: '+extra', oldLine: null, newLine: 4 },
    { text: '\\ No newline at end of file', oldLine: null, newLine: null },
    { text: '@@ -10 +11 @@', oldLine: null, newLine: null },
    { text: '-last', oldLine: 10, newLine: null },
    { text: '+next', oldLine: null, newLine: 11 },
  ])
})

test('non-text patches retain git explanations without invented line numbers', () => {
  expect(
    numberedDiffLines(
      'diff --git a/image b/image\nindex aaa..bbb 100644\nBinary files a/image and b/image differ\n',
    ),
  ).toEqual([{ text: 'Binary files a/image and b/image differ', oldLine: null, newLine: null }])
})

test('split pairs unequal replacement runs and duplicates context with both numbers', () => {
  expect(splitDiffRows('@@ -2,3 +2,4 @@\n same\n-old\n-gone\n+new\n+extra\n+last\n')).toEqual([
    { header: '@@ -2,3 +2,4 @@' },
    {
      left: { text: ' same', oldLine: 2, newLine: 2 },
      right: { text: ' same', oldLine: 2, newLine: 2 },
    },
    {
      left: { text: '-old', oldLine: 3, newLine: null },
      right: { text: '+new', oldLine: null, newLine: 3 },
    },
    {
      left: { text: '-gone', oldLine: 4, newLine: null },
      right: { text: '+extra', oldLine: null, newLine: 4 },
    },
    { left: null, right: { text: '+last', oldLine: null, newLine: 5 } },
  ])
})

test('split handles additions, deletions, multiple hunks and rename-only metadata', () => {
  expect(splitDiffRows('@@ -0,0 +1 @@\n+new\n@@ -7 +8,0 @@\n-old\n')).toEqual([
    { header: '@@ -0,0 +1 @@' },
    { left: null, right: { text: '+new', oldLine: null, newLine: 1 } },
    { header: '@@ -7 +8,0 @@' },
    { left: { text: '-old', oldLine: 7, newLine: null }, right: null },
  ])
  expect(
    splitDiffRows(
      'diff --git a/old b/new\nsimilarity index 100%\nrename from old\nrename to new\n',
    ),
  ).toEqual([
    { header: 'similarity index 100%' },
    { header: 'rename from old' },
    { header: 'rename to new' },
  ])
  expect(splitDiffRows('')).toEqual([])
})
