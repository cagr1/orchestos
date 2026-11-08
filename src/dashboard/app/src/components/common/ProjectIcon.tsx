import {
  Book,
  Bot,
  Code,
  Database,
  Folder,
  FolderClosed,
  Gamepad2,
  Globe,
  Package,
  Rocket,
  Server,
  Smartphone,
  Wrench,
} from 'lucide-react'
import { PROJECT_ICONS, type ProjectIconName } from '../../../../../projects/settings'

export { PROJECT_ICONS }

const icons = {
  FolderClosed,
  Folder,
  Code,
  Globe,
  Server,
  Database,
  Smartphone,
  Bot,
  Package,
  Rocket,
  Wrench,
  Book,
  Gamepad2,
}

export function ProjectIcon({ name, className }: { name?: string | null; className?: string }) {
  const key = PROJECT_ICONS.includes(name as ProjectIconName)
    ? (name as ProjectIconName)
    : 'FolderClosed'
  const Icon = icons[key]
  return <Icon aria-hidden="true" data-project-icon={key} className={className} />
}
