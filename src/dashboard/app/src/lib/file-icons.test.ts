import { describe, expect, test } from 'bun:test'
import { basename } from 'node:path'
import { generateManifest } from 'material-icon-theme'
import { fileIconName, folderIconName, type Manifest } from './file-icons'

const manifest: Manifest = {
  file: 'file.svg',
  folder: 'folder.svg',
  folderExpanded: 'folder-open.svg',
  fileNames: { 'package.json': 'nodejs.svg', 'readme.md': 'readme.svg' },
  fileExtensions: {
    ts: 'typescript.svg',
    'd.ts': 'typescript-def.svg',
    tsx: 'react_ts.svg',
    'test.tsx': 'test.svg',
    md: 'markdown.svg',
  },
  folderNames: { src: 'folder-src.svg' },
  folderNamesExpanded: { src: 'folder-src-open.svg' },
}

describe('file icons', () => {
  test('exact names take priority, case insensitive', () => {
    expect(fileIconName('package.json', manifest)).toBe('nodejs.svg')
    expect(fileIconName('PACKAGE.JSON', manifest)).toBe('nodejs.svg')
    expect(fileIconName('README.md', manifest)).toBe('readme.svg')
    expect(fileIconName('notes.md', manifest)).toBe('markdown.svg')
  })

  test('longest compound extension wins before the default', () => {
    expect(fileIconName('a.d.ts', manifest)).toBe('typescript-def.svg')
    expect(fileIconName('App.tsx', manifest)).toBe('react_ts.svg')
    expect(fileIconName('x.test.tsx', manifest)).toBe('test.svg')
    expect(fileIconName('x.other.tsx', manifest)).toBe('react_ts.svg')
    expect(fileIconName('unknown.unrecognized', manifest)).toBe('file.svg')
    expect(fileIconName('LICENSE', manifest)).toBe('file.svg')
    expect(fileIconName('constructor', manifest)).toBe('file.svg')
  })

  test('folders use the matching open or closed icon and defaults', () => {
    expect(folderIconName('src', false, manifest)).toBe('folder-src.svg')
    expect(folderIconName('SRC', true, manifest)).toBe('folder-src-open.svg')
    expect(folderIconName('unknown', false, manifest)).toBe('folder.svg')
    expect(folderIconName('unknown', true, manifest)).toBe('folder-open.svg')
    expect(folderIconName('constructor', false, manifest)).toBe('folder.svg')
  })

  test('resolves the real Material Icon Theme manifest', () => {
    const source = generateManifest()
    const icon = (id: string) => basename(source.iconDefinitions![id].iconPath)
    const map = (entries: Record<string, string>) =>
      Object.fromEntries(Object.entries(entries).map(([name, id]) => [name, icon(id)]))
    const real: Manifest = {
      file: icon(source.file!),
      folder: icon(source.folder!),
      folderExpanded: icon(source.folderExpanded!),
      fileNames: map(source.fileNames!),
      fileExtensions: map(source.fileExtensions!),
      folderNames: map(source.folderNames!),
      folderNamesExpanded: map(source.folderNamesExpanded!),
    }
    expect(fileIconName('package.json', real)).toBe('nodejs.svg')
    expect(fileIconName('a.d.ts', real)).toBe('typescript-def.svg')
    expect(fileIconName('App.tsx', real)).toBe('react_ts.svg')
    expect(fileIconName('README.md', real)).toBe(real.fileNames['readme.md'] ?? 'markdown.svg')
    expect(folderIconName('src', false, real)).toBe('folder-src.svg')
    expect(folderIconName('src', true, real)).toBe('folder-src-open.svg')
  })
})
