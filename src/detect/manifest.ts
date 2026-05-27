import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'

export interface Manifest {
  name: string
  runtime: string
  framework: string
  deps: string[]
}

export function readManifest(root: string): Manifest {
  const result: Manifest = { name: 'unknown', runtime: 'unknown', framework: 'unknown', deps: [] }

  // package.json — Node / Bun / JS ecosystem
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      result.name = pkg.name ?? 'unknown'
      result.runtime = 'Node.js'
      const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })
      result.deps = allDeps

      if (allDeps.includes('next')) result.framework = 'Next.js'
      else if (allDeps.includes('nuxt') || allDeps.includes('nuxt3')) result.framework = 'Nuxt'
      else if (allDeps.includes('@nestjs/core')) result.framework = 'NestJS'
      else if (allDeps.includes('express')) result.framework = 'Express'
      else if (allDeps.includes('fastify')) result.framework = 'Fastify'
      else if (allDeps.includes('vue')) result.framework = 'Vue'
      else if (allDeps.includes('react')) result.framework = 'React'
      else if (allDeps.includes('svelte')) result.framework = 'Svelte'
      else if (allDeps.includes('@angular/core')) result.framework = 'Angular'
      else result.framework = 'none'

      if (allDeps.includes('prisma') || allDeps.includes('@prisma/client')) result.deps.push('Prisma')
      if (allDeps.includes('drizzle-orm')) result.deps.push('Drizzle')
      if (allDeps.includes('typeorm')) result.deps.push('TypeORM')

      return result
    } catch { /* continue */ }
  }

  // Cargo.toml — Rust
  const cargoPath = join(root, 'Cargo.toml')
  if (existsSync(cargoPath)) {
    result.runtime = 'Rust'
    result.framework = 'none'
    try {
      const cargo = readFileSync(cargoPath, 'utf-8')
      const nameMatch = cargo.match(/^name\s*=\s*"([^"]+)"/m)
      if (nameMatch?.[1]) result.name = nameMatch[1]
      if (cargo.includes('actix-web')) result.framework = 'Actix'
      else if (cargo.includes('axum')) result.framework = 'Axum'
    } catch { /* continue */ }
    return result
  }

  // pyproject.toml / requirements.txt — Python
  const pyprojectPath = join(root, 'pyproject.toml')
  const requirementsPath = join(root, 'requirements.txt')
  if (existsSync(pyprojectPath) || existsSync(requirementsPath)) {
    result.runtime = 'Python'
    result.framework = 'none'
    try {
      const content = existsSync(pyprojectPath)
        ? readFileSync(pyprojectPath, 'utf-8')
        : readFileSync(requirementsPath, 'utf-8')
      const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m)
      if (nameMatch?.[1]) result.name = nameMatch[1]
      if (content.includes('fastapi')) result.framework = 'FastAPI'
      else if (content.includes('django')) result.framework = 'Django'
      else if (content.includes('flask')) result.framework = 'Flask'
    } catch { /* continue */ }
    return result
  }

  // *.csproj — .NET
  const csprojFiles = glob.sync('**/*.csproj', { cwd: root, maxDepth: 2, ignore: ['node_modules/**'] })
  if (csprojFiles.length > 0) {
    result.runtime = '.NET'
    result.framework = 'ASP.NET'
    result.name = (csprojFiles[0] ?? '').replace('.csproj', '').split('/').pop() ?? 'unknown'
    return result
  }

  // go.mod — Go
  const goModPath = join(root, 'go.mod')
  if (existsSync(goModPath)) {
    result.runtime = 'Go'
    result.framework = 'none'
    try {
      const gomod = readFileSync(goModPath, 'utf-8')
      const moduleMatch = gomod.match(/^module\s+(\S+)/m)
      if (moduleMatch?.[1]) result.name = moduleMatch[1].split('/').pop() ?? 'unknown'
      if (gomod.includes('gin-gonic/gin')) result.framework = 'Gin'
      else if (gomod.includes('gofiber/fiber')) result.framework = 'Fiber'
    } catch { /* continue */ }
    return result
  }

  return result
}
