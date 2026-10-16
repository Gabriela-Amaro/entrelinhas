import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowDownToLine, BookOpen, Check, ChevronDown, Code2, Columns2, FilePlus2, FileText, FolderOpen, List, LoaderCircle, Maximize2, Minimize2, Minus, Moon, PanelLeftClose, PanelLeftOpen, PencilLine, Plus, Save, Search, Settings2, Sun, X } from 'lucide-react';
import Reader, { FindBar } from './components/Reader';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import { initialWorkspace } from './lib/demo';
import { closeTab, editDocument, importBrowserFiles, isDirty, loadWorkspace, markDocumentSaved, mergeImport, normalizePath, resolveDocumentPath, saveWorkspace } from './lib/workspace';
import { toggleTask, type Heading } from './lib/markdown';
import type { DocumentFile, ImportResult, Workspace } from './types';

export default function App() {
  const [state, setState] = useState<Workspace>(initialWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [restored, setRestored] = useState(false);
  const [menu, setMenu] = useState<'open' | 'settings' | null>(null);
  const [toast, setToast] = useState('');
  const [find, setFind] = useState(false);
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [matchIndex, setMatchIndex] = useState(0);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeHeading, setActiveHeading] = useState('');
  const [dragging, setDragging] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [writingFile, setWritingFile] = useState(false);
  const writingRef = useRef(false);
  const stateRef = useRef(state);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragDepth = useRef(0);
  const saving = useRef(Promise.resolve());
  const saveGeneration = useRef(0);
  stateRef.current = state;
  const active = state.documents.find(doc => doc.id === state.activeId);
  const secondary = state.documents.find(doc => doc.id === state.secondaryId);

  const notify = useCallback((message: string) => {
    setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5500);
  }, []);
  const receiveImport = useCallback((result: ImportResult | null) => {
    if (!result) return;
    setState(current => mergeImport(current, result));
    if (result.warnings?.length) notify(result.warnings.slice(0, 2).join(' · '));
    else if (!result.documents.length) notify('Nenhum arquivo Markdown encontrado nesta seleção.');
    else notify(`${result.documents.length} ${result.documents.length === 1 ? 'arquivo adicionado' : 'arquivos adicionados'} à biblioteca.`);
  }, [notify]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const workspace = await loadWorkspace();
        if (canceled) return;
        if (workspace) { setState(workspace); setRestored(true); }
        if (window.desktop) { const pending = await window.desktop.getPending(); if (!canceled) receiveImport(pending); }
      } catch { if (!canceled) notify('Não foi possível recuperar a sessão anterior.'); }
      finally { if (!canceled) setReady(true); }
    })();
    return () => { canceled = true; };
  }, [notify, receiveImport]);

  const persist = useCallback((workspace: Workspace) => {
    const generation = ++saveGeneration.current;
    setSaved(false);
    // Serialize writes; an older session must never overwrite the newest one.
    saving.current = saving.current.catch(() => {}).then(() => saveWorkspace(workspace)).then(() => {
      if (saveGeneration.current === generation) { setSaved(true); setSaveError(false); }
    }).catch(() => { setSaveError(true); setSaved(false); });
    return saving.current;
  }, []);
  useEffect(() => { if (ready) void persist(state); }, [state, ready, persist]);
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void persist(stateRef.current); };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [persist]);
  useEffect(() => { document.documentElement.dataset.theme = state.theme; document.documentElement.style.colorScheme = state.theme; }, [state.theme]);
  useEffect(() => { document.title = active ? `${active.name} — Entrelinhas` : 'Entrelinhas · Leitor de Markdown'; }, [active]);
  useEffect(() => { setMatchIndex(0); }, [query, state.activeId]);
  useEffect(() => { setActiveHeading(''); }, [state.activeId]);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(null); };
    document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  async function pick(kind: 'files' | 'folder') {
    setMenu(null);
    if (!window.desktop) { (kind === 'files' ? fileInput : folderInput).current?.click(); return; }
    setBusy(true);
    try { receiveImport(await (kind === 'files' ? window.desktop.pickFiles() : window.desktop.pickFolder())); }
    catch (error) { notify(`Não foi possível abrir: ${String(error)}`); }
    finally { setBusy(false); }
  }
  async function importFiles(files: File[], folder: boolean) {
    if (!files.length) return;
    setBusy(true);
    try { receiveImport(await importBrowserFiles(files, folder)); }
    catch { notify('Não foi possível importar os arquivos. Verifique o espaço de armazenamento disponível.'); }
    finally { setBusy(false); }
  }
  const refreshDocument = useCallback(async (id: string) => {
    const doc = stateRef.current.documents.find(doc => doc.id === id);
    if (!doc?.native || !window.desktop || isDirty(doc) || writingRef.current) return;
    try {
      const content = await window.desktop.readDocument(doc.path);
      setState(current => ({ ...current, documents: current.documents.map(item => item.id === id && item.content === doc.content && !isDirty(item) && !writingRef.current && (item.content !== content || item.unavailable) ? { ...item, content, unavailable: false } : item) }));
    } catch { setState(current => ({ ...current, documents: current.documents.map(item => item.id === id ? { ...item, unavailable: true } : item) })); }
  }, []);
  const openDocument = useCallback((id: string) => {
    setState(current => ({ ...current, activeId: id, tabs: current.tabs.includes(id) ? current.tabs : [...current.tabs, id], secondaryId: current.secondaryId === id ? current.activeId : current.secondaryId }));
    void refreshDocument(id);
  }, [refreshDocument]);
  useEffect(() => {
    const refresh = () => { const current = stateRef.current; if (current.activeId) void refreshDocument(current.activeId); if (current.secondaryId) void refreshDocument(current.secondaryId); };
    window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh);
  }, [refreshDocument]);
  const toggleSplit = useCallback(() => {
    setState(current => {
      if (current.secondaryId) return { ...current, secondaryId: null };
      const next = current.tabs.find(id => id !== current.activeId) ?? current.documents.find(doc => doc.id !== current.activeId)?.id;
      if (!next) { notify('Abra outro arquivo para ler dois documentos lado a lado.'); return current; }
      return { ...current, secondaryId: next, tabs: current.tabs.includes(next) ? current.tabs : [...current.tabs, next], source: false };
    });
  }, [notify]);
  const change = useCallback((update: Partial<Workspace>) => setState(current => ({ ...current, ...update })), []);
  const close = useCallback((id: string) => setState(current => closeTab(current, id)), []);
  const saveScroll = useCallback((id: string, value: number) => setState(current => ({ ...current, scroll: { ...current.scroll, [id]: value } })), []);
  const edit = useCallback((id: string, content: string) => setState(current => ({ ...current, documents: current.documents.map(doc => doc.id === id ? editDocument(doc, content) : doc) })), []);
  const onTaskToggle = useCallback((id: string, line: number, checked: boolean) => setState(current => ({ ...current, documents: current.documents.map(doc => doc.id === id ? editDocument(doc, toggleTask(doc.content, line, checked)) : doc) })), []);
  const toggleEditing = useCallback(() => {
    setState(current => ({ ...current, editing: !current.editing, source: false }));
    setFind(false); setQuery('');
  }, []);
  const saveDocument = useCallback(async (saveAs = false) => {
    const doc = stateRef.current.documents.find(item => item.id === stateRef.current.activeId);
    if (!doc || writingRef.current) return;
    writingRef.current = true; setWritingFile(true);
    try {
      if (window.desktop && doc.native && !saveAs) {
        await window.desktop.writeDocument(doc.path, doc.content, doc.savedContent ?? doc.content);
        setState(current => ({ ...current, documents: current.documents.map(item => item.id === doc.id ? markDocumentSaved(item, doc.content) : item) }));
        notify('Documento salvo no arquivo original.');
      } else if (window.desktop) {
        const result = await window.desktop.saveDocumentAs(doc.name, doc.content);
        if (!result) return;
        setState(current => {
          const latest = current.documents.find(item => item.id === doc.id) || doc;
          const savedDoc = { ...result, rootId: current.documents.find(item => item.id === result.id)?.rootId, content: latest.content, savedContent: latest.content === doc.content ? undefined : doc.content };
          return { ...current, documents: [...current.documents.filter(item => item.id !== result.id).map(item => item.id === doc.id ? { ...item, content: item.savedContent ?? item.content, savedContent: undefined } : item), savedDoc],
            tabs: [...new Set(current.tabs.map(id => id === doc.id ? result.id : id))], activeId: current.activeId === doc.id ? result.id : current.activeId,
            secondaryId: current.secondaryId === result.id || current.secondaryId === doc.id ? null : current.secondaryId };
        });
        notify('Documento salvo.');
      } else {
        const url = URL.createObjectURL(new Blob([doc.content], { type: 'text/markdown;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = doc.name; document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setState(current => ({ ...current, documents: current.documents.map(item => item.id === doc.id ? markDocumentSaved(item, doc.content) : item) }));
        notify('Cópia .md enviada para os downloads.');
      }
    } catch (error) { notify(`Não foi possível salvar. ${error instanceof Error ? error.message : String(error)}`); }
    finally { writingRef.current = false; setWritingFile(false); }
  }, [notify]);
  const setDocumentFocus = useCallback((value: boolean) => {
    setFocusMode(value && !!stateRef.current.activeId);
    setMenu(null); setFind(false); setQuery('');
  }, []);
  useEffect(() => { if (!state.activeId) setFocusMode(false); }, [state.activeId]);
  function zoom(delta: number) { setState(current => ({ ...current, fontSize: Math.max(13, Math.min(24, current.fontSize + delta)) })); }
  function navigateMatch(delta: number) { if (matchCount) setMatchIndex(current => (current + delta + matchCount) % matchCount); }
  const onLink = useCallback(async (doc: DocumentFile, href: string) => {
    if (href.startsWith('#')) {
      const id = decodeURIComponent(href.slice(1));
      document.querySelector(`[data-document="${CSS.escape(doc.id)}"] [id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (/^(https?:|mailto:)/i.test(href)) {
      if (window.desktop) await window.desktop.openExternal(href);
      else window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      try {
        const path = resolveDocumentPath(doc.path, href);
        const target = stateRef.current.documents.find(item => normalizePath(item.path) === path);
        if (!target) { notify('Arquivo não encontrado na biblioteca. Abra a pasta que contém esse documento.'); return; }
        openDocument(target.id);
        const fragment = href.split('#')[1];
        if (fragment) setTimeout(() => document.querySelector(`[data-document="${CSS.escape(target.id)}"] [id="${CSS.escape(decodeURIComponent(fragment))}"]`)?.scrollIntoView({ block: 'start' }), 200);
      } catch { notify('Não foi possível abrir este link.'); }
    }
  }, [notify, openDocument]);
  const commandsRef = useRef<(command: string) => void>(() => {});
  commandsRef.current = command => {
    if (command === 'open-files') void pick('files');
    else if (command === 'open-folder') void pick('folder');
    else if (command === 'find') setFind(true);
    else if (command === 'focus-document') setDocumentFocus(!focusMode);
    else if (command === 'split') toggleSplit();
    else if (command === 'edit') toggleEditing();
    else if (command === 'save-document') void saveDocument();
    else if (command === 'save-document-as') void saveDocument(true);
    else if (command === 'theme') setState(current => ({ ...current, theme: current.theme === 'dark' ? 'light' : 'dark' }));
    else if (command === 'flush-session') {
      flushSync(() => window.dispatchEvent(new Event('flush-readers')));
      void saving.current.catch(() => {}).then(() => window.desktop?.flushAndClose(stateRef.current));
    }
  };
  useEffect(() => {
    const unsubscribeOpen = window.desktop?.onOpen(receiveImport);
    const unsubscribeCommand = window.desktop?.onCommand(command => commandsRef.current(command));
    return () => { unsubscribeOpen?.(); unsubscribeCommand?.(); };
  }, [receiveImport]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const typing = !!target?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]');
      if (event.key === 'Escape') { setMenu(null); setFind(false); if (focusMode && !document.querySelector('[role="dialog"]')) setDocumentFocus(false); }
      if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.repeat && !typing && !document.querySelector('[role="dialog"]')) {
        event.preventDefault(); setDocumentFocus(!focusMode); return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'o' && !window.desktop) { event.preventDefault(); void commandsRef.current(event.shiftKey ? 'open-folder' : 'open-files'); }
      if (key === 'f') { event.preventDefault(); setFind(true); }
      if (key === 's' && !window.desktop) { event.preventDefault(); void saveDocument(event.shiftKey); }
      if (key === 'e' && !window.desktop) { event.preventDefault(); toggleEditing(); }
      if (key === '\\' && !window.desktop) { event.preventDefault(); toggleSplit(); }
      if (key === 'w') { event.preventDefault(); const id = stateRef.current.activeId; if (id) close(id); }
      if (event.key === 'Tab') { event.preventDefault(); const current = stateRef.current; const index = current.tabs.indexOf(current.activeId || ''); const id = current.tabs[(index + (event.shiftKey ? -1 : 1) + current.tabs.length) % current.tabs.length]; if (id) openDocument(id); }
      if (key === '=' || key === '+') { event.preventDefault(); zoom(1); }
      if (key === '-') { event.preventDefault(); zoom(-1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [toggleSplit, close, openDocument, focusMode, setDocumentFocus, saveDocument, toggleEditing]);

  async function drop(event: React.DragEvent) {
    event.preventDefault(); dragDepth.current = 0; setDragging(false);
    const items = [...event.dataTransfer.items];
    const entries = items.map(item => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => !!entry);
    if (entries.some(entry => entry.isDirectory)) {
      const collected: File[] = [];
      async function walk(entry: FileSystemEntry, prefix: string): Promise<void> {
        if (entry.isFile) await new Promise<void>((resolve, reject) => (entry as FileSystemFileEntry).file(file => {
          Object.defineProperty(file, 'webkitRelativePath', { value: `${prefix}${entry.name}` }); collected.push(file); resolve();
        }, reject));
        else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          while (true) {
            const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
            if (!batch.length) break;
            for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
          }
        }
      }
      setBusy(true);
      try {
        for (const entry of entries) {
          collected.length = 0;
          await walk(entry, '');
          await importFiles([...collected], entry.isDirectory);
        }
      } catch { notify('Não foi possível ler esta pasta. Tente o botão Abrir pasta.'); }
      finally { setBusy(false); }
    } else await importFiles([...event.dataTransfer.files], false);
  }

  if (!ready) return <div className="boot-screen"><div className="brand-mark">≡</div><h1>Entrelinhas</h1><LoaderCircle className="spin" size={20} /><p>Preparando seu espaço de leitura…</p></div>;

  return <div className={`app ${state.sidebar ? '' : 'without-sidebar'} ${secondary && !focusMode ? 'split-layout' : ''} ${focusMode ? 'focus-mode' : ''}`} onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepth.current++; setDragging(true); } }} onDragLeave={event => { event.preventDefault(); if (--dragDepth.current <= 0) setDragging(false); }} onDragOver={event => event.preventDefault()} onDrop={drop}>
    <input hidden ref={fileInput} type="file" accept=".md,.markdown,.mdown,.mkd" multiple onChange={event => { void importFiles([...(event.target.files || [])], false); event.target.value = ''; }} />
    <input hidden ref={folderInput} type="file" multiple {...{ webkitdirectory: '' }} onChange={event => { void importFiles([...(event.target.files || [])], true); event.target.value = ''; }} />
    <header className="app-header"><div className="brand"><div className="brand-mark"><span /><span /><span /></div><span>entrelinhas<span className="brand-dot">.</span></span><span className="app-label">MARKDOWN READER</span></div>
      <div className={`session-indicator ${saveError ? 'save-error' : ''}`} title={saveError ? 'Não foi possível salvar. Verifique o espaço no disco.' : 'Abas, biblioteca e posição de leitura são salvas automaticamente'}>{saveError ? <X size={13} /> : saved ? <Check size={13} /> : <LoaderCircle className="spin" size={13} />}<span>{saveError ? 'Falha ao salvar sessão' : saved ? restored ? 'Sessão restaurada e salva' : 'Sessão salva' : 'Salvando sessão…'}</span></div>
      <div className="header-actions" ref={menuRef}><button className="icon-button theme-toggle" title={state.theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} onClick={() => change({ theme: state.theme === 'dark' ? 'light' : 'dark' })}>{state.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><span className="header-divider" /><div className="open-control"><button className="open-button" onClick={() => void pick('files')} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Abrir arquivos</button><button className="open-chevron" title="Mais opções de abertura" aria-expanded={menu === 'open'} onClick={() => setMenu(menu === 'open' ? null : 'open')}><ChevronDown size={14} /></button></div>
        {menu === 'open' && <div className="popover open-menu"><button onClick={() => void pick('files')}><FilePlus2 size={17} /><span>Abrir arquivos <small>Selecione um ou vários documentos</small></span><kbd>Ctrl O</kbd></button><button onClick={() => void pick('folder')}><FolderOpen size={17} /><span>Abrir pasta <small>Explore todos os seus arquivos Markdown</small></span></button></div>}
        {menu === 'settings' && <div className="popover settings-menu"><strong>Preferências de leitura</strong><label>Tamanho do texto <span className="font-controls"><button className="icon-button" title="Diminuir fonte" onClick={() => zoom(-1)}><Minus size={14} /></button>{state.fontSize}px<button className="icon-button" title="Aumentar fonte" onClick={() => zoom(1)}><Plus size={14} /></button></span></label><button onClick={() => change({ outline: !state.outline })}><List size={16} /> Índice do documento <span>{state.outline ? 'Visível' : 'Oculto'}</span></button><button onClick={() => { change({ source: !state.source, editing: false }); setMenu(null); }}><Code2 size={16} /> {state.source ? 'Exibir documento' : 'Ver Markdown original'}</button><button onClick={() => { void saveDocument(true); setMenu(null); }} disabled={!active}><Save size={16} />Salvar como…</button><div className="settings-shortcuts"><span>Focar documento <kbd>F</kbd></span><span>Editar / ler <kbd>Ctrl E</kbd></span><span>Salvar documento <kbd>Ctrl S</kbd></span><span>Buscar <kbd>Ctrl F</kbd></span><span>Próxima aba <kbd>Ctrl Tab</kbd></span><span>Fechar aba <kbd>Ctrl W</kbd></span><span>Lado a lado <kbd>Ctrl \</kbd></span></div></div>}
      </div>
    </header>
    {state.sidebar && <Sidebar state={state} onOpen={openDocument} onFolder={() => void pick('folder')} onExpanded={id => setState(current => ({ ...current, expanded: current.expanded.includes(id) ? current.expanded.filter(item => item !== id) : [...current.expanded, id] }))} onRemoveRoot={id => setState(current => ({ ...current, roots: current.roots.filter(root => root.id !== id), documents: current.documents.filter(doc => doc.rootId !== id || current.tabs.includes(doc.id) || isDirty(doc)).map(doc => doc.rootId === id ? { ...doc, rootId: undefined } : doc) }))} />}
    <main className="main-area">
      <div className="tabs-bar"><button className="icon-button sidebar-toggle" title={state.sidebar ? 'Ocultar biblioteca' : 'Mostrar biblioteca'} onClick={() => change({ sidebar: !state.sidebar })}>{state.sidebar ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button><div className="tabs" role="tablist" aria-label="Arquivos abertos">{state.tabs.map(id => {
        const doc = state.documents.find(doc => doc.id === id); if (!doc) return null;
        return <div key={id} className={`tab ${state.activeId === id ? 'active-tab' : ''} ${state.secondaryId === id ? 'secondary-tab' : ''}`}><button role="tab" aria-selected={state.activeId === id} title={doc.path} onClick={() => openDocument(id)}><FileText size={14} /><span>{doc.name}</span>{isDirty(doc) && <span className="unsaved-dot" title="Alterações não salvas no arquivo" aria-label="Alterações não salvas" />}{id === state.secondaryId && <Columns2 size={12} />}</button><button className="tab-close" aria-label={`Fechar aba ${doc.name}`} onClick={() => close(id)}><X size={13} /></button></div>;
      })}</div><button className="icon-button new-tab" title="Abrir mais arquivos" onClick={() => void pick('files')}><Plus size={16} /></button></div>
      <div className="document-toolbar"><div className="breadcrumbs"><FolderOpen size={14} /><span>{active?.rootId ? state.roots.find(root => root.id === active.rootId)?.name : 'Biblioteca'}</span><span className="breadcrumb-slash">/</span><span className="breadcrumb-file">{active?.name || 'Seu espaço de leitura'}</span></div><div className="toolbar-actions"><button className={`toolbar-button edit-toggle ${state.editing ? 'is-active' : ''}`} title="Alternar edição (Ctrl+E)" onClick={toggleEditing} disabled={!active}>{state.editing ? <BookOpen size={15} /> : <PencilLine size={15} />}<span>{state.editing ? 'Ler' : 'Editar'}</span></button><button className={`icon-button save-document ${active && isDirty(active) ? 'has-changes' : ''}`} title={active?.native ? 'Salvar documento (Ctrl+S)' : 'Salvar como .md (Ctrl+S)'} onClick={() => void saveDocument()} disabled={!active || writingFile}>{writingFile ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}</button><button className="icon-button fullscreen-toggle" title="Focar documento (F)" disabled={!active} onClick={() => setDocumentFocus(!focusMode)}><Maximize2 size={16} /></button><button className="icon-button" title="Buscar no documento (Ctrl+F)" onClick={() => setFind(!find)} disabled={!active}><Search size={16} /></button><span className="toolbar-divider" /><button className={`toolbar-button ${secondary ? 'is-active' : ''}`} title="Ler dois arquivos lado a lado (Ctrl+\)" onClick={toggleSplit} disabled={!active}><Columns2 size={15} /><span>Lado a lado</span></button><button className={`icon-button ${state.outline ? 'is-active' : ''}`} title="Alternar índice" onClick={() => change({ outline: !state.outline })}><List size={17} /></button><button className="icon-button" title="Preferências de leitura" onClick={() => setMenu(menu === 'settings' ? null : 'settings')}><Settings2 size={16} /></button></div></div>
      {find && active && <FindBar query={query} setQuery={value => { setQuery(value); setMatchIndex(0); }} count={matchCount} index={matchIndex} navigate={navigateMatch} close={() => { setFind(false); setQuery(''); }} />}
      {active ? <div className={`reading-layout ${state.outline && !secondary && !state.editing ? 'with-outline' : ''}`}>
        <div className="readers">{state.editing ? <Editor key={active.id} doc={active} fontSize={state.fontSize} onChange={edit} onSave={() => void saveDocument()} saving={writingFile} search={find ? query : ''} searchIndex={matchIndex} onSearchCount={setMatchCount} /> : <Reader key={`${active.id}:${state.source}`} doc={active} theme={state.theme} fontSize={state.fontSize} source={state.source} initialScroll={state.scroll[active.id] || 0} search={find ? query : ''} searchIndex={matchIndex} onScroll={saveScroll} onLink={onLink} onHeadings={setHeadings} onActiveHeading={setActiveHeading} onSearchCount={setMatchCount} onTaskToggle={onTaskToggle} />}
          {secondary && <Reader key={`${secondary.id}:secondary`} doc={secondary} theme={state.theme} fontSize={state.fontSize} source={false} initialScroll={state.scroll[secondary.id] || 0} search="" searchIndex={0} onScroll={saveScroll} onLink={onLink} onTaskToggle={onTaskToggle} secondary onClose={() => change({ secondaryId: null })} secondaryOptions={state.documents.filter(doc => state.tabs.includes(doc.id) && doc.id !== state.activeId)} onSecondaryChange={id => { change({ secondaryId: id }); void refreshDocument(id); }} />}
        </div>
        {state.outline && !secondary && !state.editing && <aside className="outline"><div className="outline-label"><List size={13} /> NESTA PÁGINA</div><nav aria-label="Índice do documento">{headings.filter(heading => heading.level > 1).map(heading => <button key={heading.id} className={activeHeading === heading.id ? 'current-heading' : ''} style={{ paddingLeft: (heading.level - 2) * 12 + 13 }} onClick={() => void onLink(active, `#${heading.id}`)}>{heading.text}</button>)}</nav><div className="outline-note"><span>RETOME O FIO.</span><p>Sua próxima leitura começa de onde você parou.</p><div><span className="small-saved-dot" /> Salvo automaticamente</div></div></aside>}
      </div> : <div className="empty-state"><div className="empty-illustration"><BookOpen size={44} strokeWidth={1} /></div><span className="eyebrow">ESPAÇO PARA SUAS IDEIAS</span><h1>Uma boa leitura<br />começa por aqui.</h1><p>Abra seus arquivos Markdown ou uma pasta inteira.<br />O resto a gente guarda para você.</p><div><button className="primary-button" onClick={() => void pick('files')}><FilePlus2 size={17} />Abrir arquivos</button><button className="secondary-button" onClick={() => void pick('folder')}><FolderOpen size={17} />Abrir pasta</button></div><span className="empty-hint">Você também pode arrastar arquivos e pastas para cá</span></div>}
    </main>
    <footer className="status-bar"><div><span className="status-mark">M↓</span><span>Markdown</span><span className="status-separator">·</span><span>{state.tabs.length} {state.tabs.length === 1 ? 'arquivo aberto' : 'arquivos abertos'}</span></div><div><span className="status-features">Mermaid <span>·</span> KaTeX <span>·</span> GFM</span><span className="status-separator">|</span><span>UTF-8</span><button title="Preferências de leitura" onClick={() => setMenu(menu === 'settings' ? null : 'settings')}>{state.fontSize}px</button></div></footer>
    {focusMode && <button className="focus-exit" title="Sair do foco (F ou Esc)" onClick={() => setDocumentFocus(false)}><Minimize2 size={16} /><span>Esc</span></button>}
    {toast && <div className="toast" role="status"><Check size={16} /><span>{toast}</span><button className="icon-button" title="Fechar notificação" onClick={() => setToast('')}><X size={14} /></button></div>}
    {dragging && <div className="drop-overlay"><div><ArrowDownToLine size={36} /><h2>Suas leituras moram aqui.</h2><p>Solte arquivos Markdown ou pastas para abrir.</p></div></div>}
    {busy && <div className="loading-pill"><LoaderCircle size={16} className="spin" /> Abrindo seus arquivos…</div>}
  </div>;
}
