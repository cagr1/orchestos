import {
  handleApiChat,
  handleApiChatModels,
  handleApiChatTaskBarClick,
  handleApiChatTaskBarEvents,
  handleApiChatUpload,
} from './handlers/chat.ts'
import {
  handleApiChatSessionDelete,
  handleApiChatSessionMessages,
  handleApiChatSessionPatch,
  handleApiChatSessionsCreate,
  handleApiChatSessionsList,
} from './handlers/chat-sessions.ts'
import { handleApiConfigGet, handleApiConfigInit, handleApiConfigSet } from './handlers/config.ts'
import { handleApiContextSuggest } from './handlers/context-suggest.ts'
import { handleApiExplorerFile, handleApiExplorerTree } from './handlers/explorer.ts'
import {
  handleApiInstincts,
  handleApiInstinctsApprove,
  handleApiInstinctsBulkDelete,
  handleApiInstinctsCreate,
  handleApiInstinctsDelete,
  handleApiInstinctsPropose,
  handleApiInstinctsReject,
  handleApiInstinctsSetConfidence,
} from './handlers/instincts.ts'
import {
  handleApiMemory,
  handleApiMemoryBulkDelete,
  handleApiMemoryConflictResolve,
  handleApiMemoryConflicts,
  handleApiMemoryDelete,
} from './handlers/memory.ts'
import {
  handleApiNatural,
  handleApiProjectConstitutionGet,
  handleApiProjectConstitutionPut,
  handleApiProjectContextGet,
  handleApiProjectContextRegenerate,
  handleApiProjectDetect,
  handleApiProjectIndex,
  handleApiProjectSummary,
} from './handlers/project.ts'
import { handleApiProjects } from './handlers/projects.ts'
import { handleApiRunGraph, handleApiRunGraphStatus } from './handlers/run-graph.ts'
import {
  handleApiRuns,
  handleApiRunsAnalyze,
  handleApiRunsBulkDelete,
  handleApiRunsDelete,
} from './handlers/runs.ts'
import { handleApiSessionStatus } from './handlers/session-status.ts'
import {
  handleApiHealth,
  handleApiProvidersLocal,
  handleApiSettingsGet,
  handleApiSettingsPost,
  handleApiSetup,
  handleApiSetupApiKey,
} from './handlers/setup.ts'
import {
  handleApiSkillsBuild,
  handleApiSkillsCreate,
  handleApiSkillsCurate,
  handleApiSkillsDelete,
  handleApiSkillsExport,
  handleApiSkillsGet,
  handleApiSkillsImport,
  handleApiSkillsList,
  handleApiSkillsProImport,
  handleApiSkillsProList,
  handleApiSkillsRegistryImport,
  handleApiSkillsRegistryList,
  handleApiSkillsUpdate,
} from './handlers/skills.ts'
import {
  handleApiSpecs,
  handleApiSpecsApprove,
  handleApiSpecsApproveDesign,
  handleApiSpecsArchive,
  handleApiSpecsBulkDelete,
  handleApiSpecsCreate,
  handleApiSpecsDelete,
  handleApiSpecsDraft,
  handleApiSpecsLint,
} from './handlers/specs.ts'
import {
  handleApiSystemEnginesExternalAvailability,
  handleApiSystemReset,
} from './handlers/system.ts'
import {
  handleApiSystemExecutorModes,
  handleApiTasks,
  handleApiTasksApproveSplit,
  handleApiTasksBulkDelete,
  handleApiTasksCreate,
  handleApiTasksDelete,
  handleApiTasksDiagnose,
  handleApiTasksExplain,
  handleApiTasksInit,
  handleApiTasksRun,
  handleApiTasksSplitPlan,
  handleApiTasksSteps,
} from './handlers/tasks.ts'
import { handleApiUsage } from './handlers/usage.ts'
import { errorResponse, isSameOrigin, serveStatic } from './http.ts'
import {
  type DashboardProjectContext,
  DashboardProjectError,
  resolveDashboardProject,
} from './project-context.ts'
import { DEFAULT_PORT } from './types.ts'

async function withDashboardProject(
  req: Request,
  handler: (project: DashboardProjectContext) => Response | Promise<Response>,
): Promise<Response> {
  try {
    return await handler(resolveDashboardProject(req))
  } catch (error) {
    if (error instanceof DashboardProjectError) return errorResponse(error.message, error.status)
    return errorResponse(error instanceof Error ? error.message : String(error), 500)
  }
}

export async function route(req: Request, port: number): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method

  if (
    (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') &&
    !isSameOrigin(req, port)
  ) {
    return errorResponse('Forbidden', 403)
  }

  if (method === 'POST' && url.pathname === '/api/runs/analyze') {
    return handleApiRunsAnalyze(req)
  }
  if (method === 'GET' && (url.pathname === '/api/runs' || url.pathname.startsWith('/api/runs/'))) {
    return handleApiRuns(url)
  }
  if (method === 'GET' && url.pathname === '/api/usage') {
    return handleApiUsage()
  }
  if (method === 'GET' && url.pathname === '/api/session/status') {
    return withDashboardProject(req, (project) => handleApiSessionStatus(project.root))
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/runs\/[^/]+$/)) {
    return handleApiRunsDelete(url)
  }
  if (method === 'POST' && url.pathname === '/api/runs/bulk-delete') {
    return handleApiRunsBulkDelete(req)
  }
  if (method === 'GET' && url.pathname === '/api/tasks') {
    return withDashboardProject(req, (project) => handleApiTasks(project.root))
  }
  // v0.12 / Bloque D.1.a — ruta literal DEBE ir antes de los regex `/api/tasks/[^/]+/...`
  // para que `init` no sea interpretado como un task id.
  if (method === 'POST' && url.pathname === '/api/tasks/init') {
    return withDashboardProject(req, (project) => handleApiTasksInit(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/tasks') {
    return withDashboardProject(req, (project) => handleApiTasksCreate(req, project.root))
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/tasks\/[^/]+\/run$/)) {
    return withDashboardProject(req, (project) => handleApiTasksRun(req, url, project.root))
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/tasks\/[^/]+$/)) {
    return withDashboardProject(req, (project) => handleApiTasksDelete(url, project.root))
  }
  if (method === 'POST' && url.pathname === '/api/tasks/bulk-delete') {
    return withDashboardProject(req, (project) => handleApiTasksBulkDelete(req, project.root))
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/diagnose$/)) {
    return withDashboardProject(req, (project) => handleApiTasksDiagnose(url, project.root))
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/explain$/)) {
    return withDashboardProject(req, (project) => handleApiTasksExplain(url, project.root))
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/split-plan$/)) {
    return withDashboardProject(req, (project) => handleApiTasksSplitPlan(url, project.root))
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/tasks\/[^/]+\/approve-split$/)) {
    return withDashboardProject(req, (project) => handleApiTasksApproveSplit(url, project.root))
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/steps$/)) {
    return handleApiTasksSteps(url)
  }
  if (method === 'POST' && url.pathname === '/api/run/graph') {
    return withDashboardProject(req, (project) => handleApiRunGraph(req, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/run/graph/status') {
    return withDashboardProject(req, (project) => handleApiRunGraphStatus(project.root))
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
  if (method === 'DELETE' && url.pathname.match(/^\/api\/instincts\/[^/]+$/)) {
    return handleApiInstinctsDelete(url)
  }
  if (method === 'POST' && url.pathname === '/api/instincts/bulk-delete') {
    return handleApiInstinctsBulkDelete(req)
  }
  if (method === 'POST' && url.pathname === '/api/instincts/propose') {
    return handleApiInstinctsPropose(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/confidence$/)) {
    return handleApiInstinctsSetConfidence(req, url)
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

  if (method === 'GET' && url.pathname === '/api/projects') {
    return handleApiProjects()
  }
  if (method === 'GET' && url.pathname === '/api/project/constitution') {
    return withDashboardProject(req, (project) => handleApiProjectConstitutionGet(project.root))
  }
  if (method === 'PUT' && url.pathname === '/api/project/constitution') {
    return withDashboardProject(req, (project) =>
      handleApiProjectConstitutionPut(req, project.root),
    )
  }
  if (method === 'GET' && url.pathname === '/api/project/context') {
    return withDashboardProject(req, (project) => handleApiProjectContextGet(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/project/context/regenerate') {
    return withDashboardProject(req, (project) => handleApiProjectContextRegenerate(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/project/detect') {
    return withDashboardProject(req, (project) => handleApiProjectDetect(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/project/index') {
    return withDashboardProject(req, (project) => handleApiProjectIndex(project.root))
  }
  // v0.12 D.1.c — ruta literal DEBE ir antes del catch-all GET→serveStatic
  // de abajo (sirve un PDF binario, no HTML estático).
  if (method === 'GET' && url.pathname === '/api/project/summary') {
    return withDashboardProject(req, (project) => handleApiProjectSummary(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/natural') {
    return withDashboardProject(req, (project) => handleApiNatural(req, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/chat/models') {
    return handleApiChatModels()
  }
  if (method === 'GET' && url.pathname === '/api/chat/sessions') {
    return handleApiChatSessionsList()
  }
  if (method === 'POST' && url.pathname === '/api/chat/sessions') {
    return handleApiChatSessionsCreate(req)
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/chat\/sessions\/[^/]+\/messages$/)) {
    return handleApiChatSessionMessages(url)
  }
  if (method === 'PATCH' && url.pathname.match(/^\/api\/chat\/sessions\/[^/]+$/)) {
    return handleApiChatSessionPatch(req, url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/chat\/sessions\/[^/]+$/)) {
    return handleApiChatSessionDelete(url)
  }
  if (method === 'POST' && url.pathname === '/api/chat/upload') {
    return handleApiChatUpload(req)
  }
  if (method === 'POST' && url.pathname === '/api/chat') {
    return handleApiChat(req)
  }
  if (method === 'POST' && url.pathname === '/api/chat/task-bar-click') {
    return handleApiChatTaskBarClick()
  }
  if (method === 'GET' && url.pathname === '/api/chat/task-bar-events') {
    return handleApiChatTaskBarEvents()
  }
  if (method === 'GET' && url.pathname === '/api/specs') {
    return withDashboardProject(req, (project) => handleApiSpecs(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/specs/draft') {
    return withDashboardProject(req, (project) => handleApiSpecsDraft(req, project.root))
  }
  // v0.12 Bloque A — DEBE ir antes del /^\/api\/specs\/[^/]+$/ genérico de abajo
  // (handleApiSpecsCreate): sin id con slash, ese regex también matchea
  // "/api/specs/bulk-delete" y se comería esta ruta.
  if (method === 'POST' && url.pathname === '/api/specs/bulk-delete') {
    return withDashboardProject(req, (project) => handleApiSpecsBulkDelete(req, project.root))
  }
  if (method === 'POST' && /^\/api\/specs\/[^/]+$/.test(url.pathname)) {
    return withDashboardProject(req, (project) => handleApiSpecsCreate(req, project.root))
  }
  // AA.4 (IDEAS #6) — ruta propia junto al resto de approve/lint/archive.
  if (method === 'POST' && url.pathname.endsWith('/approve-design')) {
    return withDashboardProject(req, (project) => handleApiSpecsApproveDesign(req, project.root))
  }
  if (method === 'POST' && url.pathname.endsWith('/approve')) {
    return withDashboardProject(req, (project) => handleApiSpecsApprove(req, project.root))
  }
  if (method === 'GET' && url.pathname.endsWith('/lint')) {
    return withDashboardProject(req, (project) => handleApiSpecsLint(req, project.root))
  }
  if (method === 'POST' && url.pathname.endsWith('/archive')) {
    return withDashboardProject(req, (project) => handleApiSpecsArchive(req, project.root))
  }
  if (method === 'DELETE' && /^\/api\/specs\/[^/]+$/.test(url.pathname)) {
    return withDashboardProject(req, (project) => handleApiSpecsDelete(req, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/memory/conflicts') {
    return handleApiMemoryConflicts(url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/memory\/conflicts\/([^/]+)\/resolve$/)) {
    return handleApiMemoryConflictResolve(url)
  }
  if (method === 'GET' && url.pathname === '/api/memory') {
    return handleApiMemory(url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/memory\/[^/]+$/)) {
    return handleApiMemoryDelete(url)
  }
  if (method === 'POST' && url.pathname === '/api/memory/bulk-delete') {
    return handleApiMemoryBulkDelete(req)
  }
  if (method === 'GET' && url.pathname === '/api/settings') {
    return withDashboardProject(req, (project) => handleApiSettingsGet(project.root))
  }
  if (method === 'GET' && url.pathname === '/api/setup') {
    return withDashboardProject(req, (project) => handleApiSetup(project.root))
  }
  if (method === 'GET' && url.pathname === '/api/health') {
    return withDashboardProject(req, (project) => handleApiHealth(project.root))
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
  if (method === 'POST' && url.pathname === '/api/system/reset') {
    return withDashboardProject(req, (project) => handleApiSystemReset(req, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/system/engines/external/availability') {
    return handleApiSystemEnginesExternalAvailability()
  }
  if (method === 'GET' && url.pathname === '/api/system/executor-modes') {
    return withDashboardProject(req, (project) => handleApiSystemExecutorModes(project.root))
  }
  if (method === 'GET' && url.pathname === '/api/config') {
    return withDashboardProject(req, (project) => handleApiConfigGet(project.root))
  }
  if (method === 'POST' && url.pathname === '/api/config/init') {
    return withDashboardProject(req, (project) => handleApiConfigInit(project.root))
  }
  if (method === 'PUT' && url.pathname === '/api/config') {
    return withDashboardProject(req, (project) => handleApiConfigSet(req, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/context/suggest') {
    return withDashboardProject(req, (project) => handleApiContextSuggest(url, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/explorer/tree') {
    return withDashboardProject(req, (project) => handleApiExplorerTree(url, project.root))
  }
  if (method === 'GET' && url.pathname === '/api/explorer/file') {
    return withDashboardProject(req, (project) => handleApiExplorerFile(url, project.root))
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
