import { AlertTriangle, Trash2, X } from 'lucide-react'
import type React from 'react'

interface DeleteProjectModalProps {
  isOpen: boolean
  projectName: string
  onClose: () => void
  onConfirm: () => void
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  projectName,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-card bg-app-surface border border-rose-800/50 p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-app pb-3">
          <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            <h2 id="delete-project-title">Delete Project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-muted hover:text-app rounded-control"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-app-muted leading-relaxed">
          Are you sure you want to remove{' '}
          <strong className="text-app font-semibold">{projectName}</strong> from this workspace?
          <br />
          <span className="text-rose-400/90 mt-1 block">
            It leaves the list; its data stays. Add it again to restore it.
          </span>
        </p>

        <div className="flex justify-end gap-2 pt-2 border-t border-app">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Project</span>
          </button>
        </div>
      </div>
    </div>
  )
}
