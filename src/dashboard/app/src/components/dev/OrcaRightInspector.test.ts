import { describe, expect, test } from 'bun:test'
import type { FileNode } from '../../types/orchestos'
import { attachExplorerChildren, foldersToLoad } from './OrcaRightInspector'

describe('OrcaRightInspector file tree', () => {
  test('loads folder entries into the matching node without mutating the root', async () => {
    const root: FileNode[] = [{ name: 'src', path: 'src', isDir: true }]
    const children: FileNode[] = [{ name: 'main.ts', path: 'src/main.ts', isDir: false }]
    const getExplorerTree = async (path: string, projectId: string) => {
      expect(path).toBe('src')
      expect(projectId).toBe('project-1')
      return children
    }

    const loaded = attachExplorerChildren(root, 'src', await getExplorerTree('src', 'project-1'))
    expect(loaded).toEqual([{ ...root[0], children }])
    expect(root[0]?.children).toBeUndefined()
  })

  test('replaces a matching folder at any tree depth', () => {
    const root: FileNode[] = [
      {
        name: 'src',
        path: 'src',
        isDir: true,
        children: [{ name: 'nested', path: 'src/nested', isDir: true }],
      },
    ]
    const children: FileNode[] = [{ name: 'index.ts', path: 'src/nested/index.ts', isDir: false }]
    expect(
      attachExplorerChildren(root, 'src/nested', children)[0]?.children?.[0]?.children,
    ).toEqual(children)
  })

  test('attaches a late folder response to a refreshed tree instance', () => {
    const refreshedRoot: FileNode[] = [{ name: 'src', path: 'src', isDir: true }]
    const children: FileNode[] = [{ name: 'index.ts', path: 'src/index.ts', isDir: false }]

    expect(attachExplorerChildren(refreshedRoot, 'src', children)).toEqual([
      { ...refreshedRoot[0], children },
    ])
  })

  test('ignores a late folder response when the path is absent from the refreshed tree', () => {
    const refreshedRoot: FileNode[] = [{ name: 'docs', path: 'docs', isDir: true }]

    expect(attachExplorerChildren(refreshedRoot, 'src', [])).toEqual(refreshedRoot)
  })

  test('loads expanded nested folders as their parent children arrive', () => {
    const expanded = { src: true, 'src/nested': true }
    const root: FileNode[] = [{ name: 'src', path: 'src', isDir: true }]
    expect(foldersToLoad(root, expanded)).toEqual(['src'])

    const withSrcChildren = attachExplorerChildren(root, 'src', [
      { name: 'nested', path: 'src/nested', isDir: true },
    ])
    expect(foldersToLoad(withSrcChildren, expanded)).toEqual(['src/nested'])

    const withNestedChildren = attachExplorerChildren(withSrcChildren, 'src/nested', [
      { name: 'index.ts', path: 'src/nested/index.ts', isDir: false },
    ])
    expect(foldersToLoad(withNestedChildren, expanded)).toEqual([])
  })
})
