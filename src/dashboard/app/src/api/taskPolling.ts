import { listTasks } from './tasks'

/** Keep the selected project's list separate from the active thread's report/approval source. */
export async function pollProjectAndThreadTasks(
  selectedProjectId: string,
  threadProjectId: string | null | undefined,
  readTasks = listTasks,
) {
  const selectedRead = readTasks(selectedProjectId)
  const threadRead =
    threadProjectId === selectedProjectId ? selectedRead : readTasks(threadProjectId)
  const [selected, thread] = await Promise.all([selectedRead, threadRead])
  return { projectTasks: selected.tasks, threadTasks: thread.tasks }
}
