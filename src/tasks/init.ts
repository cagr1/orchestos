/**
 * src/tasks/init.ts — v0.12 / Bloque D.1.a
 *
 * Lógica de scaffold de tasks.yaml extraída del CLI (`orchestos task init`,
 * src/cli.ts:805-837) para que el endpoint del dashboard `POST /api/tasks/init`
 * y el comando del CLI compartan el mismo código. La única diferencia entre
 * los dos caminos es la superficie: el CLI imprime a stdout, el endpoint
 * devuelve JSON. La función pura de scaffold vive acá.
 *
 * Decisión clave (auditoría D.1): el dashboard hoy NO tiene cómo generar el
 * primer tasks.yaml — `POST /api/tasks` devuelve 404 si el archivo no existe
 * (`src/dashboard/handlers/tasks.ts:84-85`). Sin este helper, un usuario sin
 * terminal queda bloqueado antes de poder crear su primera tarea desde el
 * dashboard puro. El scaffold genera 2 tareas starter según el stack
 * detectado por `buildProfile()` (Next.js → componentes, Python → utils+test,
 * genérico → helper+doc) — mismo comportamiento que el CLI.
 */
import { writeFileSync } from 'fs'
import { stringify as yamlStringify } from 'yaml'
import { buildProfile } from '../detect/profile.ts'
import { tasksExist, tasksPath } from './loader.ts'

export interface ScaffoldResult {
  /** Ruta absoluta al tasks.yaml recién creado. */
  path: string
  /** Nombre del proyecto detectado por buildProfile (puede ser genérico si no se detectó). */
  project: string
  /** Stack detectado — útil para que el endpoint/devuelva al UI sin re-leer el archivo. */
  framework: string | null
  runtime: string | null
  /** IDs de las tareas starter generadas. */
  taskIds: string[]
}

/**
 * Genera `tasks.yaml` en la raíz indicada con 2 tareas starter basadas en el
 * stack detectado. Si el archivo ya existe, lanza Error (el caller decide si
 * traducir eso a 409 o a un mensaje de CLI).
 *
 * Importante: esta función ESCRIE EN DISCO. Los callers deben pedir
 * confirmación al usuario antes (CLI: ya lo hace implícitamente al ser un
 * comando explícito; endpoint: `Modal.confirm()` en el frontend).
 */
export async function scaffoldTasksYaml(root: string): Promise<ScaffoldResult> {
  if (tasksExist(root)) {
    throw new Error(`tasks.yaml already exists in ${root}`)
  }
  const profile = await buildProfile(root)
  const { manifest } = profile

  // Mismo set de scaffolds que el CLI original (cli.ts:818-830)
  const isNext   = manifest.framework === 'Next.js'
  const isPython = manifest.runtime   === 'Python'

  const tasks = isNext ? [
    { id: 't1-component', description: 'Create a reusable Button component', skill: 'implement', input: [], output: ['src/components/Button.tsx'], depends_on: [], status: 'pending', retry_count: 0 },
    { id: 't2-styles',    description: 'Add CSS module styles for Button', skill: 'implement', input: ['src/components/Button.tsx'], output: ['src/components/Button.module.css'], depends_on: ['t1-component'], status: 'pending', retry_count: 0 },
  ] : isPython ? [
    { id: 't1-util', description: 'Create a utility function for string normalization', skill: 'implement', input: [], output: ['utils/normalize.py'], depends_on: [], status: 'pending', retry_count: 0 },
    { id: 't2-test', description: 'Write unit tests for the normalize utility', skill: 'implement', input: ['utils/normalize.py'], output: ['tests/test_normalize.py'], depends_on: ['t1-util'], status: 'pending', retry_count: 0 },
  ] : [
    { id: 't1-util', description: 'Create a utility helper function', skill: 'implement', input: [], output: ['src/utils/helper.js'], depends_on: [], status: 'pending', retry_count: 0 },
    { id: 't2-doc',  description: 'Add JSDoc comments to the helper', skill: 'doc', input: ['src/utils/helper.js'], output: ['src/utils/helper.js'], depends_on: ['t1-util'], status: 'pending', retry_count: 0 },
  ]

  const content = yamlStringify({ version: 1, project: manifest.name, tasks }, { lineWidth: 120 })
  const path = tasksPath(root)
  writeFileSync(path, content, 'utf-8')

  return {
    path,
    project: manifest.name,
    framework: manifest.framework,
    runtime: manifest.runtime,
    taskIds: tasks.map((t: { id: string }) => t.id),
  }
}
