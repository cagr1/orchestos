import { FolderGit2, Plus, X } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'

interface AddProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, branch?: string) => void
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [projectName, setProjectName] = useState('')
  const [branch, setBranch] = useState('main')

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName.trim()) return
    onCreate(projectName.trim(), branch.trim() || 'main')
    setProjectName('')
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-project-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-card bg-app-surface border border-app p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-app pb-3">
          <div className="flex items-center gap-2 text-app font-semibold text-sm">
            <FolderGit2 className="w-4 h-4 text-app-accent" />
            <h2 id="add-project-title">Add Workspace Project</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-muted hover:text-app rounded-control"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-app-muted mb-1 font-medium">Project Name</label>
            <input
              type="text"
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. backend-api or auth-service"
              className="w-full px-3 py-1.5 rounded-control bg-app-bg border border-app text-app focus:outline-hidden focus:border-app-accent font-mono text-xs"
              required
            />
          </div>

          <div>
            <label className="block text-app-muted mb-1 font-medium">Default Git Branch</label>
            <input
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              className="w-full px-3 py-1.5 rounded-control bg-app-bg border border-app text-app focus:outline-hidden focus:border-app-accent font-mono text-xs"
            />
          </div>

          <p className="text-app-muted text-xs leading-relaxed">
            Registers the repository within OrchestOS workspace contracts, AST analyzer, and sandbox
            worktree isolates.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-app">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!projectName.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent text-zinc-950 font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Project</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
