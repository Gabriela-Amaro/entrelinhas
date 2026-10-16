import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, FileText, Folder, FolderOpen, FolderPlus, Plus, Search, X } from 'lucide-react';
import type { DocumentFile, FolderRoot, Workspace } from '../types';

interface Props {
  state: Workspace;
  onOpen: (id: string) => void;
  onFolder: () => void;
  onExpanded: (id: string) => void;
  onRemoveRoot: (id: string) => void;
}
interface TreeNode { name: string; path: string; children: TreeNode[]; doc?: DocumentFile }
function buildTree(documents: DocumentFile[], root: FolderRoot): TreeNode[] {
  const tree: TreeNode[] = [];
  for (const doc of documents) {
    const normalized = doc.path.replaceAll('\\', '/');
    const base = root.path.replaceAll('\\', '/').replace(/\/$/, '') + '/';
    const parts = (normalized.startsWith(base) ? normalized.slice(base.length) : doc.name).split('/');
    let nodes = tree;
    let partial = root.id;
    parts.forEach((name, index) => {
      partial += '/' + name;
      let item = nodes.find(node => node.name === name);
      if (!item) { item = { name, path: partial, children: [] }; nodes.push(item); }
      if (index === parts.length - 1) item.doc = doc;
      nodes = item.children;
    });
  }
  const sort = (nodes: TreeNode[]) => { nodes.sort((a, b) => Number(!!a.doc) - Number(!!b.doc) || a.name.localeCompare(b.name, 'pt-BR', { numeric: true })); nodes.forEach(node => sort(node.children)); };
  sort(tree); return tree;
}

export default function Sidebar(props: Props) {
  const { state } = props;
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => state.documents.filter(doc => doc.path.toLocaleLowerCase().includes(filter.toLocaleLowerCase())), [state.documents, filter]);
  const file = (doc: DocumentFile) => <div className={`file-row ${doc.id === state.activeId ? 'selected' : ''} ${doc.id === state.secondaryId ? 'in-secondary' : ''}`} key={doc.id}>
    <button className="file-row-button" onClick={() => props.onOpen(doc.id)} title={doc.path}><FileText size={15} /><span>{doc.name}</span>{doc.id === state.activeId && <span className="active-file-dot" />}</button>
  </div>;
  function nodes(items: TreeNode[], level = 0): React.ReactNode {
    return items.map(node => node.doc ? <div key={node.path} style={{ paddingLeft: level * 13 }}>{file(node.doc)}</div> : <div key={node.path}>
      <button className="tree-directory" style={{ paddingLeft: 10 + level * 13 }} onClick={() => props.onExpanded(node.path)}>{state.expanded.includes(node.path) || filter ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<Folder size={14} /><span>{node.name}</span></button>
      {(state.expanded.includes(node.path) || filter) && nodes(node.children, level + 1)}
    </div>);
  }
  return <aside className="sidebar">
    <div className="sidebar-top"><span className="eyebrow">SEU ESPAÇO</span><h2>Biblioteca<span>{state.documents.filter(doc => !doc.id.startsWith('demo/')).length || ''}</span></h2><p>Um arquivo, muitas possibilidades.</p></div>
    <label className="file-filter"><Search size={14} /><input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Encontrar arquivo…" aria-label="Encontrar arquivo" /><kbd>⌕</kbd></label>
    <div className="sidebar-scroll">
      <div className="explorer-title"><span className="section-label">EXPLORADOR</span><button className="icon-button" onClick={props.onFolder} title="Adicionar pasta"><FolderPlus size={14} /></button></div>
      {state.roots.map(root => {
        const docs = filtered.filter(doc => doc.rootId === root.id);
        const expanded = state.expanded.includes(root.id) || !!filter;
        return <section className="folder-root" key={root.id}>
          <div className="folder-root-heading"><button className="root-toggle" onClick={() => props.onExpanded(root.id)} title={root.path}>{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{expanded ? <FolderOpen size={15} /> : <Folder size={15} />}<span>{root.name}</span></button><button className="row-close" title={`Remover pasta ${root.name} da biblioteca`} onClick={() => props.onRemoveRoot(root.id)}><X size={12} /></button></div>
          {expanded && <div className="folder-contents">{nodes(buildTree(docs, root))}{!docs.length && <span className="tree-empty">Nenhum Markdown nesta pasta</span>}</div>}
        </section>;
      })}
      {filtered.filter(doc => !doc.rootId).length > 0 && <section className="loose-files"><div className="section-label">ARQUIVOS</div>{filtered.filter(doc => !doc.rootId).map(doc => file(doc))}</section>}
      {!filtered.length && <div className="sidebar-empty"><Search size={22} /><p>Nenhum arquivo encontrado.</p></div>}
      <button className="add-folder" onClick={props.onFolder}><Plus size={15} /><span>Adicionar pasta</span></button>
    </div>
    <div className="sidebar-bottom"><div className="local-label"><span /><span>Só você e seus arquivos.</span></div><div className="local-caption"><BookOpen size={13} /><span>Leitura local, sem distrações</span></div></div>
  </aside>;
}
