import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp, FileCode2, Maximize2, Minus, Plus, X } from 'lucide-react';
import DOMPurify from 'dompurify';
import { renderMarkdown, type Heading } from '../lib/markdown';
import { imageUrl } from '../lib/workspace';
import type { DocumentFile } from '../types';

let diagramId = 0;
let diagramQueue = Promise.resolve();
interface Props {
  doc: DocumentFile;
  theme: 'dark' | 'light';
  fontSize: number;
  source: boolean;
  initialScroll: number;
  search: string;
  searchIndex: number;
  secondary?: boolean;
  onScroll: (id: string, value: number) => void;
  onLink: (doc: DocumentFile, href: string) => void;
  onHeadings?: (headings: Heading[]) => void;
  onActiveHeading?: (id: string) => void;
  onSearchCount?: (count: number) => void;
  onClose?: () => void;
  secondaryOptions?: DocumentFile[];
  onSecondaryChange?: (id: string) => void;
  onTaskToggle: (id: string, line: number, checked: boolean) => void;
}

export default function Reader(props: Props) {
  const { doc, theme, source, initialScroll, search, searchIndex, onHeadings, onSearchCount } = props;
  const scroller = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const restored = useRef(false);
  const initialPosition = useRef(initialScroll);
  const readingPosition = useRef(initialScroll);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScroll = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [expandedDiagram, setExpandedDiagram] = useState<string | null>(null);
  const rendered = useMemo(() => renderMarkdown(doc.content), [doc.content]);
  const wordCount = doc.content.trim().split(/\s+/).filter(Boolean).length;
  useEffect(() => { onHeadings?.(rendered.headings); }, [rendered, onHeadings]);

  useLayoutEffect(() => {
    restored.current = false;
    initialPosition.current = readingPosition.current;
    if (scroller.current) scroller.current.scrollTop = initialPosition.current;
  }, [rendered.html, source]);

  useEffect(() => {
    const node = article.current;
    if (!node || source) { restored.current = true; return; }
    let canceled = false;
    const urls: string[] = [];
    const images = [...node.querySelectorAll<HTMLImageElement>('img[data-local-src]')].map(async image => {
      const result = await imageUrl(doc, image.dataset.localSrc || '');
      if (canceled) { if (result.revoke) URL.revokeObjectURL(result.url); return; }
      if (result.revoke) urls.push(result.url);
      if (result.url) { image.src = result.url; await image.decode().catch(() => {}); }
      else { image.classList.add('missing-image'); image.alt = `${image.alt || 'Imagem'} · importe a pasta para carregar`; }
    });
    const blocks = [...node.querySelectorAll<HTMLElement>('.mermaid-block')];
    const diagrams = blocks.map(block => {
      const job = async () => {
        if (canceled) return;
        try {
          const { default: mermaid } = await import('mermaid');
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', look: 'classic', suppressErrorRendering: true,
            htmlLabels: false, flowchart: { htmlLabels: false },
            fontFamily: 'Inter Variable, system-ui, sans-serif',
            themeVariables: { darkMode: theme === 'dark', background: theme === 'dark' ? '#191b1a' : '#fbfaf6',
              primaryColor: theme === 'dark' ? '#30392d' : '#eaf0e8', primaryTextColor: theme === 'dark' ? '#e9e9e2' : '#303b30',
              primaryBorderColor: '#7e9171', lineColor: '#91a389', secondaryColor: theme === 'dark' ? '#34352c' : '#f2ecdf',
              tertiaryColor: theme === 'dark' ? '#282d27' : '#f2f3e9', textColor: theme === 'dark' ? '#e9e9e2' : '#303b30' } });
          const id = `diagram-${++diagramId}`;
          const { svg } = await mermaid.render(id, decodeURIComponent(block.dataset.mermaid || ''));
          if (canceled) return;
          block.innerHTML = '<div class="diagram-toolbar"><span>MERMAID</span><button type="button" class="expand-diagram" aria-label="Ampliar diagrama">Ampliar ↗</button></div><div class="diagram-canvas"></div>';
          block.querySelector('.diagram-canvas')!.innerHTML = DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } });
          block.querySelector('.expand-diagram')?.addEventListener('click', () => setExpandedDiagram(svg));
        } catch (error) {
          if (canceled) return;
          block.innerHTML = '';
          const details = document.createElement('details'); details.className = 'diagram-error';
          const summary = document.createElement('summary'); summary.textContent = 'Não foi possível renderizar este diagrama. Ver código';
          const pre = document.createElement('pre'); pre.textContent = decodeURIComponent(block.dataset.mermaid || '');
          const message = document.createElement('small'); message.textContent = String(error).split('\n').slice(0, 3).join('\n');
          details.append(summary, pre, message); block.append(details);
        }
      };
      const result = diagramQueue.then(job, job);
      diagramQueue = result;
      return result;
    });
    Promise.allSettled([...images, ...diagrams]).then(async () => {
      await document.fonts.ready;
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (canceled) return;
      if (!restored.current && scroller.current) scroller.current.scrollTop = initialPosition.current;
      restored.current = true;
      scroller.current?.setAttribute('data-ready', 'true');
    });
    // Allow immediate scrolling while a large diagram is rendering.
    const handleUserScroll = () => { restored.current = true; };
    scroller.current?.addEventListener('wheel', handleUserScroll, { passive: true });
    const container = scroller.current;
    return () => { canceled = true; urls.forEach(url => URL.revokeObjectURL(url)); container?.removeEventListener('wheel', handleUserScroll); };
  }, [doc, rendered.html, source, theme]);

  useEffect(() => {
    const node = article.current;
    if (!node) return;
    node.querySelectorAll('mark.search-match').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent || '')));
    node.normalize();
    if (!search.trim()) { onSearchCount?.(0); return; }
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const text = walker.currentNode as Text;
      if (!text.parentElement?.closest('button,.mermaid-block,.katex,script,style')) textNodes.push(text);
    }
    let count = 0;
    const needle = search.toLocaleLowerCase();
    textNodes.forEach(text => {
      const value = text.textContent || '';
      const lower = value.toLocaleLowerCase();
      let at = 0, index = lower.indexOf(needle);
      if (index < 0) return;
      const fragment = document.createDocumentFragment();
      while (index >= 0 && count < 2000) {
        fragment.append(document.createTextNode(value.slice(at, index)));
        const match = document.createElement('mark'); match.className = 'search-match'; match.dataset.match = String(count++); match.textContent = value.slice(index, index + search.length); fragment.append(match);
        at = index + search.length; index = lower.indexOf(needle, at);
      }
      fragment.append(document.createTextNode(value.slice(at))); text.replaceWith(fragment);
    });
    onSearchCount?.(count);
  }, [search, rendered.html, source, onSearchCount]);
  useEffect(() => {
    article.current?.querySelectorAll('.search-current').forEach(node => node.classList.remove('search-current'));
    const match = article.current?.querySelector(`[data-match="${searchIndex}"]`);
    match?.classList.add('search-current'); match?.scrollIntoView({ block: 'center' });
  }, [searchIndex, search, rendered.html]);

  useEffect(() => {
    const flush = () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      if (pendingScroll.current !== null) { props.onScroll(doc.id, pendingScroll.current); pendingScroll.current = null; }
    };
    window.addEventListener('flush-readers', flush);
    return () => { flush(); window.removeEventListener('flush-readers', flush); };
  }, [doc.id, props.onScroll]);

  function handleScroll() {
    const container = scroller.current;
    if (!container) return;
    const max = container.scrollHeight - container.clientHeight;
    setProgress(max > 0 ? Math.round(container.scrollTop / max * 100) : 100);
    let active = rendered.headings[0]?.id || '';
    for (const heading of rendered.headings) {
      const node = article.current?.querySelector(`[id="${CSS.escape(heading.id)}"]`);
      if (node && node.getBoundingClientRect().top < container.getBoundingClientRect().top + 160) active = heading.id;
    }
    props.onActiveHeading?.(active);
    if (!restored.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    const top = container.scrollTop;
    readingPosition.current = top;
    pendingScroll.current = top;
    scrollTimer.current = setTimeout(() => { props.onScroll(doc.id, top); pendingScroll.current = null; }, 80);
  }
  async function handleClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.matches('input.task-list-item-checkbox[data-task-line]')) {
      const input = target as HTMLInputElement;
      props.onTaskToggle(doc.id, Number(input.dataset.taskLine), input.checked);
      return;
    }
    const copy = target.closest<HTMLButtonElement>('button.copy-code');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.closest('.code-block')?.querySelector('code')?.textContent || ''); copy.textContent = 'Copiado ✓'; setTimeout(() => { copy.textContent = 'Copiar'; }, 1800); }
      catch { copy.textContent = 'Não foi possível copiar'; }
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[href]');
    if (link) { event.preventDefault(); props.onLink(doc, link.getAttribute('href') || ''); }
  }

  return <section className={`reader-pane ${props.secondary ? 'secondary-pane' : ''}`} data-document={doc.id}>
    {props.secondary && <div className="secondary-header"><FileCode2 size={14} /><select aria-label="Documento do segundo painel" value={doc.id} onChange={event => props.onSecondaryChange?.(event.target.value)}>{props.secondaryOptions?.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select><button className="icon-button" onClick={props.onClose} title="Fechar leitura lado a lado"><X size={15} /></button></div>}
    <div className="reader-scroll" ref={scroller} onScroll={handleScroll} data-reader-scroll={doc.id}>
      <div className="document-topline"><span>{doc.rootId ? 'BIBLIOTECA' : 'DOCUMENTO'}</span><span className="reading-time">{Math.max(1, Math.ceil(wordCount / 220))} min de leitura</span></div>
      {doc.unavailable && <div className="unavailable-note"><AlertCircle size={16} /> Arquivo indisponível no disco. Exibindo a última cópia salva.</div>}
      {source ? <article className="source-view" ref={article} onClick={handleClick} style={{ fontSize: props.fontSize - 2 }}><pre>{doc.content}</pre></article>
        : <article className="markdown-body" ref={article} onClick={handleClick} style={{ fontSize: props.fontSize }} dangerouslySetInnerHTML={{ __html: rendered.html }} />}
      <div className="document-end"><Check size={14} /><span>Você chegou ao fim. Até a próxima ideia.</span></div>
    </div>
    <div className="reader-progress" style={{ width: `${progress}%` }} />
    {expandedDiagram && <DiagramModal svg={expandedDiagram} onClose={() => setExpandedDiagram(null)} />}
  </section>;
}

function DiagramModal({ svg, onClose }: { svg: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  return <div className="modal-backdrop diagram-modal" role="dialog" aria-modal="true" aria-label="Diagrama ampliado">
    <div className="diagram-modal-top"><span>Diagrama Mermaid <small>Arraste para mover · role para ampliar</small></span><div className="button-group"><button className="icon-button" title="Diminuir diagrama" onClick={() => setZoom(Math.max(.2, zoom - .2))}><Minus size={18} /></button><span>{Math.round(zoom * 100)}%</span><button className="icon-button" title="Ampliar diagrama" onClick={() => setZoom(Math.min(5, zoom + .2))}><Plus size={18} /></button><button className="icon-button" title="Restaurar diagrama" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}><Maximize2 size={18} /></button><button className="icon-button" title="Fechar diagrama" autoFocus onClick={onClose}><X size={20} /></button></div></div>
    <div className="diagram-stage" onWheel={event => setZoom(value => Math.max(.2, Math.min(5, value + (event.deltaY < 0 ? .1 : -.1))))}
      onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY, originX: position.x, originY: position.y }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (drag.current) setPosition({ x: drag.current.originX + event.clientX - drag.current.x, y: drag.current.originY + event.clientY - drag.current.y }); }}
      onPointerUp={() => { drag.current = null; }}>
      <div style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true, html: true } }) }} />
    </div>
  </div>;
}

export function FindBar({ query, setQuery, count, index, navigate, close }: { query: string; setQuery: (query: string) => void; count: number; index: number; navigate: (delta: number) => void; close: () => void }) {
  return <div className="find-bar"><input autoFocus aria-label="Buscar no documento" placeholder="Buscar neste documento…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') close(); if (event.key === 'Enter') navigate(event.shiftKey ? -1 : 1); }} /><span>{count ? `${index + 1} de ${count}` : query ? 'Nenhum resultado' : ''}</span><button className="icon-button" title="Resultado anterior" disabled={!count} onClick={() => navigate(-1)}><ChevronUp size={16} /></button><button className="icon-button" title="Próximo resultado" disabled={!count} onClick={() => navigate(1)}><ChevronDown size={16} /></button><button className="icon-button" title="Fechar busca" onClick={close}><X size={16} /></button></div>;
}
