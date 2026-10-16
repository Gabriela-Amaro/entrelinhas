import { get, set, setMany } from 'idb-keyval';
import type { DocumentFile, ImportResult, Workspace } from '../types';

export const MARKDOWN = /\.(md|markdown|mdown|mkd)$/i;
export const isDirty = (doc: DocumentFile): boolean => doc.savedContent !== undefined && doc.content !== doc.savedContent;
export function editDocument(doc: DocumentFile, content: string): DocumentFile {
  const baseline = doc.savedContent ?? doc.content;
  return { ...doc, content, savedContent: content === baseline ? undefined : baseline };
}
export function markDocumentSaved(doc: DocumentFile, savedContent: string): DocumentFile {
  return { ...doc, savedContent: doc.content === savedContent ? undefined : savedContent, unavailable: false };
}
export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (segment === '..') parts.pop();
    else if (segment && segment !== '.') parts.push(segment);
  }
  return (path.startsWith('/') ? '/' : '') + parts.join('/');
}
export function resolveDocumentPath(path: string, href: string): string {
  const target = decodeURIComponent(href.split('#')[0].split('?')[0]);
  return normalizePath(target.startsWith('/') || /^[A-Za-z]:/.test(target) ? target : `${path.replaceAll('\\', '/').split('/').slice(0, -1).join('/')}/${target}`);
}
export function mergeImport(state: Workspace, result: ImportResult): Workspace {
  const documents = new Map(state.documents.map(doc => [doc.id, doc]));
  const roots = new Map(state.roots.map(root => [root.id, root]));
  result.documents.forEach(doc => { if (!documents.has(doc.id) || !isDirty(documents.get(doc.id)!)) documents.set(doc.id, doc); });
  result.roots.forEach(root => roots.set(root.id, root));
  // A folder goes to the explorer. A multi-file selection opens every file as a tab.
  const toOpen = result.roots.length ? result.documents.slice(0, 1) : result.documents;
  const tabs = [...new Set([...state.tabs, ...toOpen.map(doc => doc.id)])];
  const activeId = toOpen[0]?.id ?? state.activeId;
  return { ...state, documents: [...documents.values()], roots: [...roots.values()], tabs,
    activeId, secondaryId: state.secondaryId === activeId ? null : state.secondaryId,
    expanded: [...new Set([...state.expanded, ...result.roots.map(root => root.id)])] };
}
export function closeTab(state: Workspace, id: string): Workspace {
  const index = state.tabs.indexOf(id);
  const tabs = state.tabs.filter(tab => tab !== id);
  const activeId = state.activeId === id ? (tabs[Math.min(index, tabs.length - 1)] ?? null) : state.activeId;
  return { ...state, tabs, activeId, secondaryId: state.secondaryId === id || state.secondaryId === activeId ? null : state.secondaryId };
}
export function validateWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as Workspace;
  if (state.version !== 1 || !Array.isArray(state.documents) || !Array.isArray(state.roots) || !Array.isArray(state.tabs)) return null;
  const documents = state.documents.filter(doc => typeof doc.id === 'string' && typeof doc.content === 'string' && typeof doc.path === 'string' && typeof doc.name === 'string');
  const ids = new Set(documents.map(doc => doc.id));
  const tabs = [...new Set(state.tabs.filter(id => ids.has(id)))];
  const activeId = state.activeId && tabs.includes(state.activeId) ? state.activeId : tabs[0] ?? null;
  return { ...state, documents, tabs, activeId,
    secondaryId: state.secondaryId && tabs.includes(state.secondaryId) && state.secondaryId !== activeId ? state.secondaryId : null,
    scroll: state.scroll || {}, expanded: Array.isArray(state.expanded) ? state.expanded : [],
    theme: state.theme === 'light' ? 'light' : 'dark', fontSize: Math.min(24, Math.max(13, state.fontSize || 16)),
    sidebar: state.sidebar !== false, outline: state.outline !== false, source: !!state.source, editing: !!state.editing };
}
export async function loadWorkspace(): Promise<Workspace | null> {
  const saved = window.desktop ? await window.desktop.restore() : await get('workspace-v1');
  const state = validateWorkspace(saved);
  if (!state || !window.desktop) return state;
  // Re-read tabs so edits made in another editor appear after reopening the app.
  const open = new Set(state.tabs);
  state.documents = await Promise.all(state.documents.map(async doc => {
    if (!doc.native || !open.has(doc.id) || isDirty(doc)) return doc;
    try { return { ...doc, content: await window.desktop!.readDocument(doc.path), unavailable: false }; }
    catch { return { ...doc, unavailable: true }; }
  }));
  return state;
}
export function saveWorkspace(state: Workspace): Promise<void> {
  return window.desktop ? window.desktop.save(state) : set('workspace-v1', state);
}
export async function importBrowserFiles(files: File[], folder: boolean): Promise<ImportResult> {
  const warnings: string[] = [];
  const rootName = folder ? files[0]?.webkitRelativePath.split('/')[0] : '';
  const rootId = rootName ? `browser-folder:${rootName}` : '';
  const documents: DocumentFile[] = [];
  const assets: [string, Blob][] = [];
  for (const file of files) {
    const filePath = folder ? file.webkitRelativePath : `arquivos/${file.name}`;
    if (MARKDOWN.test(file.name)) {
      if (file.size > 20 * 1024 * 1024) { warnings.push(`${file.name}: o arquivo excede 20 MB.`); continue; }
      documents.push({ id: `browser:${filePath}`, path: filePath, name: file.name, content: await file.text(), rootId: rootId || undefined });
    } else if (/\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i.test(file.name)) assets.push([`asset:${filePath}`, file]);
  }
  if (assets.length) await setMany(assets);
  documents.sort((a, b) => a.path.localeCompare(b.path, 'pt-BR', { numeric: true }));
  return { documents, roots: rootId ? [{ id: rootId, path: rootName, name: rootName }] : [], warnings };
}
export async function imageUrl(doc: DocumentFile, src: string): Promise<{ url: string; revoke?: boolean }> {
  if (/^(https?:|data:|blob:)/i.test(src)) return { url: src };
  const path = resolveDocumentPath(doc.path, src);
  if (doc.native) return { url: `md-asset://local/image?path=${encodeURIComponent(path)}` };
  const blob = await get<Blob>(`asset:${path}`);
  return blob ? { url: URL.createObjectURL(blob), revoke: true } : { url: '' };
}
