export interface Manifest {
  file: string
  folder: string
  folderExpanded: string
  fileExtensions: Record<string, string>
  fileNames: Record<string, string>
  folderNames: Record<string, string>
  folderNamesExpanded: Record<string, string>
}

export function fileIconName(name: string, m: Manifest): string {
  const lower = name.toLowerCase()
  if (Object.hasOwn(m.fileNames, lower)) return m.fileNames[lower] ?? m.file
  for (let dot = lower.indexOf('.'); dot !== -1; dot = lower.indexOf('.', dot + 1)) {
    const extension = lower.slice(dot + 1)
    if (Object.hasOwn(m.fileExtensions, extension)) return m.fileExtensions[extension] ?? m.file
  }
  return m.file
}

export function folderIconName(name: string, expanded: boolean, m: Manifest): string {
  const names = expanded ? m.folderNamesExpanded : m.folderNames
  const lower = name.toLowerCase()
  const fallback = expanded ? m.folderExpanded : m.folder
  return Object.hasOwn(names, lower) ? names[lower] ?? fallback : fallback
}
