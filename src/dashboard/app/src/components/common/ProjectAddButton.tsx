import { Plus } from 'lucide-react'
import { ActionMenuButton } from './ActionMenuButton'

export type ProjectAddAction = 'open' | 'clone'
export function ProjectAddButton({
  onSelect,
  label = 'Add project',
}: {
  onSelect: (action: ProjectAddAction) => void
  label?: string
}) {
  return (
    <ActionMenuButton
      label={label}
      menuLabel="Add project"
      className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface transition-colors"
      options={[
        { label: 'Open folder', action: () => onSelect('open') },
        { label: 'Clone from URL', action: () => onSelect('clone') },
      ]}
    >
      <Plus className="w-4 h-4" />
    </ActionMenuButton>
  )
}
