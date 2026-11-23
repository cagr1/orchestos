export function cliUpdatesLabel(count: number): string {
  return `${count} CLI update${count === 1 ? '' : 's'}`
}
export async function runCliUpdatesSequentially<T>(
  rows: T[],
  update: (row: T) => Promise<void>,
): Promise<void> {
  for (const row of rows) await update(row)
}
