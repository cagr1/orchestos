import { serveStatic, errorResponse, isSameOrigin } from './http.ts'
import { handleApiMemory } from './handlers/memory.ts'
import { handleApiRuns } from './handlers/runs.ts'
import { handleApiInstincts, handleApiInstinctsApprove, handleApiInstinctsReject, handleApiInstinctsCreate } from './handlers/instincts.ts'
import { handleApiSpecsDraft, handleApiSpecs } from './handlers/specs.ts'
import { handleApiTasks, handleApiTasksCreate, handleApiTasksRun, handleApiTasksDelete, handleApiTasksDiagnose } from './handlers/tasks.ts'
import { handleApiProjectConstitutionGet, handleApiProjectConstitutionPut, handleApiProjectContextGet, handleApiProjectContextRegenerate, handleApiNatural } from './handlers/project.ts'
import { handleApiSettingsGet, handleApiSetup, handleApiSettingsPost, handleApiHealth, handleApiSetupApiKey, handleApiProvidersLocal } from './handlers/setup.ts'
import { handleApiChatUpload, handleApiChatModels, handleApiChat } from './handlers/chat.ts'
import { handleApiSkillsList, handleApiSkillsGet, handleApiSkillsExport, handleApiSkillsCreate, handleApiSkillsUpdate, handleApiSkillsDelete, handleApiSkillsBuild, handleApiSkillsProList, handleApiSkillsProImport, handleApiSkillsImport, handleApiSkillsCurate, handleApiSkillsRegistryList, handleApiSkillsRegistryImport } from './handlers/skills.ts'
import { DEFAULT_PORT } from './types.ts'

export async function route(req: Request, port: number): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method

  if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && !isSameOrigin(req, port)) {
    return errorResponse('Forbidden', 403)
  }

  if (method === 'GET' && (url.pathname === '/api/runs' || url.pathname.startsWith('/api/runs/'))) {
    return handleApiRuns(url)
  }
  if (method === 'GET' && url.pathname === '/api/tasks') {
    return handleApiTasks()
  }
  if (method === 'POST' && url.pathname === '/api/tasks') {
    return handleApiTasksCreate(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/tasks\/[^/]+\/run$/)) {
    return handleApiTasksRun(url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/tasks\/[^/]+$/)) {
    return handleApiTasksDelete(url)
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/diagnose$/)) {
    return handleApiTasksDiagnose(url)
  }
  if (method === 'GET' && url.pathname === '/api/instincts') {
    return handleApiInstincts()
  }
  if (method === 'POST' && url.pathname === '/api/instincts') {
    return handleApiInstinctsCreate(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/approve$/)) {
    return handleApiInstinctsApprove(url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/reject$/)) {
    return handleApiInstinctsReject(url)
  }

  if (method === 'GET' && url.pathname === '/api/skills') {
    return handleApiSkillsList()
  }
  if (method === 'GET' && url.pathname === '/api/skills/registry') {
    return handleApiSkillsRegistryList()
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/registry\/([^/]+)\/import$/)) {
    return handleApiSkillsRegistryImport(req, url)
  }
  if (method === 'GET' && url.pathname === '/api/skills/pro') {
    return handleApiSkillsProList()
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsGet(url)
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/skills\/([^/]+)\/export$/)) {
    return handleApiSkillsExport(url)
  }
  if (method === 'POST' && url.pathname === '/api/skills') {
    return handleApiSkillsCreate(req)
  }
  if (method === 'PUT' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsUpdate(req, url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsDelete(req, url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/([^/]+)\/build$/)) {
    return handleApiSkillsBuild(url)
  }
  if (method === 'POST' && url.pathname === '/api/skills/curate') {
    return handleApiSkillsCurate(req)
  }
  if (method === 'POST' && url.pathname === '/api/skills/import') {
    return handleApiSkillsImport(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/pro\/([^/]+)\/import$/)) {
    return handleApiSkillsProImport(url)
  }

  if (method === 'GET' && url.pathname === '/api/project/constitution') {
    return handleApiProjectConstitutionGet()
  }
  if (method === 'PUT' && url.pathname === '/api/project/constitution') {
    return handleApiProjectConstitutionPut(req)
  }
  if (method === 'GET' && url.pathname === '/api/project/context') {
    return handleApiProjectContextGet()
  }
  if (method === 'POST' && url.pathname === '/api/project/context/regenerate') {
    return handleApiProjectContextRegenerate()
  }
  if (method === 'POST' && url.pathname === '/api/natural') {
    return handleApiNatural(req)
  }
  if (method === 'GET' && url.pathname === '/api/chat/models') {
    return handleApiChatModels()
  }
  if (method === 'POST' && url.pathname === '/api/chat/upload') {
    return handleApiChatUpload(req)
  }
  if (method === 'POST' && url.pathname === '/api/chat') {
    return handleApiChat(req)
  }
  if (method === 'GET' && url.pathname === '/api/specs') {
    return handleApiSpecs()
  }
  if (method === 'POST' && url.pathname === '/api/specs/draft') {
    return handleApiSpecsDraft(req)
  }
  if (method === 'GET' && url.pathname === '/api/memory') {
    return handleApiMemory()
  }
  if (method === 'GET' && url.pathname === '/api/settings') {
    return await handleApiSettingsGet()
  }
  if (method === 'GET' && url.pathname === '/api/setup') {
    return handleApiSetup()
  }
  if (method === 'GET' && url.pathname === '/api/health') {
    return handleApiHealth()
  }
  if (method === 'GET' && url.pathname === '/api/providers/local') {
    return handleApiProvidersLocal()
  }
  if (method === 'POST' && url.pathname === '/api/setup/api-key') {
    return await handleApiSetupApiKey(req)
  }
  if (method === 'POST' && url.pathname === '/api/settings') {
    return handleApiSettingsPost(req)
  }

  if (method === 'GET') {
    return serveStatic(url.pathname)
  }

  return errorResponse('Method not allowed', 405)
}

export function startServer(port = DEFAULT_PORT): { server: any; url: string } {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    // Default idle timeout (10s) is too short for routes that call an LLM with
    // retries (curator, registry import normalization) or fetch external
    // registries before normalizing — those can legitimately take 15-30s.
    // Without this, Bun kills the connection before the response is delivered
    // even though the handler keeps running and completes the work server-side.
    idleTimeout: 60,
    fetch: (req) => route(req, port),
  })
  const url = `http://localhost:${server.port}`
  console.log(`[dashboard] Server running at ${url}`)
  return { server, url }
}

if (import.meta.main) {
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT))
  startServer(port)
}
