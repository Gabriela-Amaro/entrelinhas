import { describe, expect, it } from 'vitest';
import { closeTab, editDocument, isDirty, markDocumentSaved, mergeImport, resolveDocumentPath, validateWorkspace } from '../src/lib/workspace';
import { initialWorkspace } from '../src/lib/demo';

describe('Abas e sessão', () => {
  it('mantém o original como base do rascunho e limpa a marca ao desfazer', () => {
    const original = initialWorkspace().documents[0];
    const edited = editDocument(editDocument(original, '# Texto'), '# Texto final');
    expect(edited.savedContent).toBe(original.content);
    expect(isDirty(edited)).toBe(true);
    expect(isDirty(editDocument(edited, original.content))).toBe(false);
  });
  it('preserva digitação que ocorreu enquanto um salvamento estava em andamento', () => {
    const original = initialWorkspace().documents[0];
    const doc = editDocument(editDocument(original, '# Primeiro'), '# Segundo');
    const saved = markDocumentSaved(doc, '# Primeiro');
    expect(saved.content).toBe('# Segundo');
    expect(saved.savedContent).toBe('# Primeiro');
    expect(isDirty(saved)).toBe(true);
    expect(isDirty(markDocumentSaved(saved, saved.content))).toBe(false);
  });
  it('não substitui rascunhos por arquivos reimportados', () => {
    const state = initialWorkspace();
    const original = state.documents[0];
    state.documents = state.documents.map(doc => doc.id === original.id ? editDocument(original, '# Rascunho') : doc);
    const result = mergeImport(state, { documents: [{ ...original, content: '# Do disco' }], roots: [] });
    expect(result.documents.find(doc => doc.id === original.id)?.content).toBe('# Rascunho');
  });
  const doc = (id: string) => ({ id, name: `${id}.md`, path: `pasta/${id}.md`, content: `# ${id}` });
  it('abre todos os arquivos de uma seleção sem duplicar abas existentes', () => {
    const state = initialWorkspace();
    const next = mergeImport(state, { documents: [doc('a'), doc('b'), doc('a')], roots: [] });
    expect(next.tabs.slice(-2)).toEqual(['a', 'b']);
    expect(next.activeId).toBe('a');
    expect(next.documents.filter(item => item.id === 'a')).toHaveLength(1);
  });
  it('adiciona a pasta inteira ao explorador sem abrir centenas de abas', () => {
    const next = mergeImport(initialWorkspace(), { documents: [doc('a'), doc('b')], roots: [{ id: 'root', name: 'pasta', path: 'pasta' }] });
    expect(next.tabs).toContain('a');
    expect(next.tabs).not.toContain('b');
    expect(next.documents.some(item => item.id === 'b')).toBe(true);
    expect(next.expanded).toContain('root');
  });
  it('escolhe uma aba vizinha e mantém os dois painéis consistentes ao fechar', () => {
    const state = { ...initialWorkspace(), secondaryId: 'demo/guide' };
    const next = closeTab(state, 'demo/welcome');
    expect(next.activeId).toBe('demo/guide');
    expect(next.secondaryId).toBeNull();
    expect(closeTab(next, 'demo/guide').activeId).toBeNull();
  });
  it('não perde rolagens, preferências e a comparação durante importações', () => {
    const state = { ...initialWorkspace(), scroll: { 'demo/welcome': 1280 }, theme: 'light' as const, secondaryId: 'demo/guide' };
    const next = mergeImport(state, { documents: [doc('a')], roots: [] });
    expect(next.scroll['demo/welcome']).toBe(1280);
    expect(next.theme).toBe('light');
    expect(next.secondaryId).toBe('demo/guide');
  });
  it('não duplica o mesmo documento nos dois painéis ao reimportar', () => {
    const state = { ...initialWorkspace(), secondaryId: 'demo/guide' };
    const next = mergeImport(state, { documents: [state.documents[1]], roots: [] });
    expect(next.activeId).toBe('demo/guide');
    expect(next.secondaryId).toBeNull();
  });
  it('recupera uma sessão parcial sem IDs pendurados e limita a fonte', () => {
    const result = validateWorkspace({ ...initialWorkspace(), activeId: 'sumiu', tabs: ['sumiu', 'demo/guide'], secondaryId: 'demo/guide', fontSize: 100 });
    expect(result?.tabs).toEqual(['demo/guide']);
    expect(result?.activeId).toBe('demo/guide');
    expect(result?.secondaryId).toBeNull();
    expect(result?.fontSize).toBe(24);
    expect(validateWorkspace({ version: 0 })).toBeNull();
  });
  it('resolve links relativos, nomes codificados e caminhos Windows', () => {
    expect(resolveDocumentPath('/projeto/docs/README.md', '../Guia%20de%20uso.md#instalar')).toBe('/projeto/Guia de uso.md');
    expect(resolveDocumentPath('C:\\projeto\\docs\\README.md', '../img/foto.png')).toBe('C:/projeto/img/foto.png');
    expect(resolveDocumentPath('pasta/readme.md', './outra.md')).toBe('pasta/outra.md');
  });
});
