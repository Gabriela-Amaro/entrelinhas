import { useEffect, useMemo, useRef, useState } from 'react';
import { Code2, Save } from 'lucide-react';
import type { DocumentFile } from '../types';
import { isDirty } from '../lib/workspace';

export default function Editor({ doc, fontSize, onChange, onSave, saving, search, searchIndex, onSearchCount }: {
  doc: DocumentFile;
  fontSize: number;
  onChange: (id: string, content: string) => void;
  onSave: () => void;
  saving: boolean;
  search: string;
  searchIndex: number;
  onSearchCount: (count: number) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const matches = useMemo(() => {
    const result: number[] = [];
    if (!search.trim()) return result;
    const text = doc.content.toLocaleLowerCase();
    const needle = search.toLocaleLowerCase();
    for (let at = text.indexOf(needle); at !== -1 && result.length < 2000; at = text.indexOf(needle, at + needle.length)) result.push(at);
    return result;
  }, [doc.content, search]);
  useEffect(() => { onSearchCount(matches.length); }, [matches, onSearchCount]);
  useEffect(() => {
    const node = input.current;
    const at = matches[searchIndex];
    if (!node || at === undefined) return;
    node.setSelectionRange(at, at + search.length);
    const line = doc.content.slice(0, at).split('\n').length;
    node.scrollTop = Math.max(0, line * (fontSize - 2) * 1.9 - node.clientHeight / 2);
  }, [matches, searchIndex, search, doc.content, fontSize]);
  useEffect(() => { input.current?.focus(); }, [doc.id]);
  const updatePosition = () => {
    const node = input.current;
    if (!node) return;
    const lines = node.value.slice(0, node.selectionStart).split('\n');
    setPosition({ line: lines.length, column: lines.at(-1)!.length + 1 });
  };
  return <section className="editor-pane" aria-label={`Edição de ${doc.name}`}>
    <div className="editor-heading"><span><Code2 size={14} /> MARKDOWN</span><span>{isDirty(doc) ? 'Alterações guardadas na sessão' : 'Sem alterações pendentes'}</span></div>
    <textarea ref={input} className="markdown-editor" aria-label="Editor Markdown" value={doc.content} spellCheck={false} autoCapitalize="off" autoCorrect="off" style={{ fontSize: fontSize - 2 }}
      onChange={event => { onChange(doc.id, event.target.value); updatePosition(); }} onSelect={updatePosition} />
    <div className="editor-footer"><span>Linha {position.line}, coluna {position.column}</span><button onClick={onSave} disabled={saving}><Save size={13} />{doc.native ? 'Salvar no arquivo' : 'Salvar como .md'}<kbd>Ctrl S</kbd></button></div>
  </section>;
}
