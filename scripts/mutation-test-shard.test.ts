import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mutationTestArgs, selectMutationShardTests } from './mutation-test-shard.ts'

describe('selectMutationShardTests', () => {
  test('mutation test args include --bail', () => {
    expect(mutationTestArgs(['src/__tests__/example.test.ts'])).toContain('--bail')
  })

  test('selector de shard incluye imports directos y transitivos, omite los que no alcanzan archivos mutados', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-shard-'))
    try {
      await mkdir(join(root, 'src/__tests__'), { recursive: true })
      await mkdir(join(root, 'src/lib'), { recursive: true })
      await writeFile(join(root, 'src/__tests__/direct.test.ts'), "import '../lib/target.ts'\n")
      await writeFile(join(root, 'src/__tests__/transitive.test.ts'), "import '../lib/bridge.ts'\n")
      await writeFile(join(root, 'src/__tests__/unrelated.test.ts'), "import '../lib/other.ts'\n")
      await writeFile(join(root, 'src/lib/bridge.ts'), "export { value } from './target.ts'\n")
      await writeFile(join(root, 'src/lib/target.ts'), 'export const value = 1\n')
      await writeFile(join(root, 'src/lib/other.ts'), 'export const other = 1\n')
      expect(await selectMutationShardTests(root, ['src/lib/target.ts'])).toEqual([
        'src/__tests__/direct.test.ts',
        'src/__tests__/transitive.test.ts',
      ])
      expect(await selectMutationShardTests(root, ['src/no-match.ts'])).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
