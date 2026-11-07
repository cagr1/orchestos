import { FileCode, Folder } from 'lucide-react'
import { useFileIcons } from '../../hooks/useFileIcons'
import { fileIconName, folderIconName } from '../../lib/file-icons'

export function FileIcon({
  name,
  kind,
  expanded = false,
  className,
}: {
  name: string
  kind: 'file' | 'folder'
  expanded?: boolean
  className?: string
}) {
  const manifest = useFileIcons()
  if (!manifest) {
    const Icon = kind === 'folder' ? Folder : FileCode
    return <Icon className={className} aria-hidden />
  }
  const icon =
    kind === 'folder' ? folderIconName(name, expanded, manifest) : fileIconName(name, manifest)
  return (
    <img
      src={`/app/dist/file-icons/${icon}`}
      alt=""
      aria-hidden
      draggable={false}
      className={className}
    />
  )
}
