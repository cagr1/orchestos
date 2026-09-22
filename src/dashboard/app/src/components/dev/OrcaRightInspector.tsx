import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, FileText, Folder, FolderOpen, GitCompare, RefreshCw, Search } from 'lucide-react';
import type { FileNode, ProjectItem, RunItem } from '../../types/orchestos';
import { getExplorerFile, getExplorerTree } from '../../api/explorer';

interface OrcaRightInspectorProps { currentProject: ProjectItem; recentRuns: RunItem[] }

export const OrcaRightInspector: React.FC<OrcaRightInspectorProps> = ({ currentProject, recentRuns }) => {
  const [tab, setTab] = useState<'files' | 'diff'>('files');
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<FileNode>();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const loadDirectory = async (path = '') => {
    setLoading(true);
    try {
      const entries = await getExplorerTree(path, currentProject.id);
      if (!path) setNodes(entries);
      else setNodes((current) => current.map((node) => node.path === path ? { ...node, children: entries } : node));
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadDirectory(); }, [currentProject.id]);

  const toggle = async (node: FileNode) => {
    if (!node.isDir) {
      setSelected(await getExplorerFile(node.path, currentProject.id));
      return;
    }
    const open = !expanded[node.path];
    setExpanded((value) => ({ ...value, [node.path]: open }));
    if (open && !node.children) await loadDirectory(node.path);
  };

  const renderTree = (items: FileNode[], depth = 0): React.ReactNode => items
    .filter((node) => !query || node.name.toLowerCase().includes(query.toLowerCase()))
    .map((node) => <div key={node.path}><button type="button" onClick={() => void toggle(node)} className={`w-full flex items-center gap-1.5 py-1 px-2 rounded-control text-xs text-left ${depth === 0 ? 'pl-2.5' : depth === 1 ? 'pl-6' : depth === 2 ? 'pl-10' : 'pl-14'} ${selected?.path === node.path ? 'bg-app-surface text-app-accent border border-app' : 'text-app-muted hover:text-app hover:bg-app-surface/50'}`}>
      {node.isDir ? (expanded[node.path] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />) : <span className="w-3.5" />}
      {node.isDir ? <Folder className="w-3.5 h-3.5 text-app-accent" /> : node.name.endsWith('.md') ? <FileText className="w-3.5 h-3.5 text-amber-400/80" /> : <FileCode className="w-3.5 h-3.5 text-sky-400/80" />}
      <span className="truncate">{node.name}</span>
    </button>{node.isDir && expanded[node.path] && node.children && renderTree(node.children, depth + 1)}</div>);

  const diffRuns = recentRuns.filter((run) => run.fileDiffs?.length);
  return <aside className="w-96 flex-shrink-0 border-l border-app bg-app-bg flex flex-col h-full overflow-hidden text-app select-none z-10">
    <div className="h-11 border-b border-app px-2 flex items-center gap-1 bg-app-surface/40 flex-shrink-0"><button type="button" onClick={() => setTab('files')} className={`app-tab-btn ${tab === 'files' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}><FolderOpen className="w-3.5 h-3.5 text-app-accent" />Files</button><button type="button" onClick={() => setTab('diff')} className={`app-tab-btn ${tab === 'diff' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}><GitCompare className="w-3.5 h-3.5 text-emerald-400" />Diff</button></div>
    {tab === 'files' ? <div className="flex-1 flex flex-col overflow-hidden"><div className="p-3 border-b border-app flex items-center justify-between"><span className="font-semibold text-xs truncate">{currentProject.name}</span><button type="button" onClick={() => void loadDirectory()} aria-label="Refresh file tree" className="p-1 text-app-muted hover:text-app"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button></div><div className="p-2 border-b border-app"><div className="relative"><Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find files" className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control text-app placeholder:text-app-muted focus:outline-hidden" /></div></div><div className="flex-1 overflow-y-auto p-1 font-mono text-xs">{renderTree(nodes)}</div>{selected && <div className="h-56 border-t border-app bg-app-surface flex flex-col"><div className="px-3 py-1.5 border-b border-app bg-app-elevated/70 text-xs font-mono text-app-accent truncate">{selected.path}</div><pre className="flex-1 p-2.5 overflow-auto text-xs text-app bg-app-bg whitespace-pre-wrap">{selected.content}</pre></div>}</div> : <div className="flex-1 overflow-y-auto p-3 space-y-3">{diffRuns.length === 0 ? <p className="text-xs text-app-muted">No run has produced a diff yet.</p> : diffRuns.map((run) => <section key={run.id} className="space-y-2"><div className="text-xs font-mono text-app-muted">{run.taskId || run.id}</div>{run.fileDiffs.map((diff, index) => <pre key={`${run.id}-${index}`} className="p-2 rounded-card border border-app bg-app-surface text-xs whitespace-pre-wrap">{diff.diff || diff.patch || `${diff.filePath || diff.path || 'changed file'} (+${diff.additions || 0} -${diff.deletions || 0})`}</pre>)}</section>)}</div>}
  </aside>;
};
