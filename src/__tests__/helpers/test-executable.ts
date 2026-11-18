import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function createTestExecutable(
  directory: string,
  name: string,
  source: string,
  nativeOnWindows = false,
): string {
  const scriptPath = join(directory, `${name}.bun.ts`)
  const launcherPath = join(directory, process.platform === 'win32' ? `${name}.cmd` : name)
  writeFileSync(scriptPath, source)

  if (process.platform === 'win32' && nativeOnWindows) {
    const executablePath = join(directory, `${name}.exe`)
    const result = Bun.spawnSync(
      [process.execPath, 'build', '--compile', scriptPath, '--outfile', executablePath],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to compile ${name}:\n${Buffer.from(result.stderr).toString()}\n${Buffer.from(result.stdout).toString()}`,
      )
    }
    return executablePath
  }

  if (process.platform === 'win32') {
    writeFileSync(launcherPath, `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`)
  } else {
    writeFileSync(launcherPath, `#!/bin/sh\nexec "${process.execPath}" "${scriptPath}" "$@"\n`)
    chmodSync(launcherPath, 0o755)
  }

  return launcherPath
}
