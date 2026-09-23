import { fileURLToPath } from 'url'

export function resolveDashboardPaths(moduleUrl: string): {
  packageRoot: string
  uiBundle: string
} {
  return {
    packageRoot: fileURLToPath(new URL('../', moduleUrl)),
    uiBundle: fileURLToPath(new URL('./dashboard/app/dist/main.js', moduleUrl)),
  }
}
