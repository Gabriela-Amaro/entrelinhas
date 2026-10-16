// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown, toggleTask } from '../src/lib/markdown';

const parse = (source: string) => {
  const element = document.createElement('div');
  element.innerHTML = renderMarkdown(source).html;
  return element;
};
describe('Markdown avançado', () => {
  it('habilita tarefas e vincula a linha original mesmo com frontmatter, código e listas aninhadas', () => {
    const source = '---\r\ntitle: Tarefas\r\n---\r\n\r\n~~~md\r\n- [ ] Exemplo de código\r\n~~~\r\n\r\n- [ ] Primeira\r\n  - [X] Segunda\r\n\r\n> - [ ] Dentro da citação\r\n';
    const node = parse(source);
    const tasks = [...node.querySelectorAll<HTMLInputElement>('input.task-list-item-checkbox')];
    expect(tasks).toHaveLength(3);
    expect(tasks.map(task => task.disabled)).toEqual([false, false, false]);
    expect(tasks.map(task => Number(task.dataset.taskLine))).toEqual([8, 9, 11]);
    const changed = toggleTask(source, Number(tasks[2].dataset.taskLine), true);
    expect(changed).toContain('> - [x] Dentro da citação\r\n');
    expect(changed).toContain('- [ ] Exemplo de código\r\n');
    expect(toggleTask(changed, 11, false)).toBe(source);
  });
  it('renderiza tabelas, tarefas, links e notas de rodapé', () => {
    const node = parse('| A | B |\n|---|---|\n| 1 | 2 |\n\n- [x] Pronto\n\nTexto[^1]\n\n[^1]: Uma nota.\n\nhttps://example.com');
    expect(node.querySelectorAll('td')).toHaveLength(2);
    expect(node.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBe(true);
    expect(node.querySelector('.footnotes')?.textContent).toContain('Uma nota.');
    expect(node.querySelector('a[href="https://example.com"]')).not.toBeNull();
  });
  it('preserva Mermaid com setas e caracteres HTML sem inserir markup', () => {
    const source = 'flowchart LR\nA["<b>Uma ideia</b>"] --> B[Outra]\n';
    const node = parse('~~~mermaid\n' + source + '~~~');
    const encoded = node.querySelector<HTMLElement>('[data-mermaid]')?.dataset.mermaid;
    expect(decodeURIComponent(encoded || '')).toBe(source);
    expect(node.querySelector('b')).toBeNull();
  });
  it('renderiza KaTeX em linha e em bloco, mantendo o layout das frações', () => {
    const node = parse('$a^2$\n\n$$\n\\frac{1}{2}\n$$');
    expect(node.querySelectorAll('.katex')).toHaveLength(2);
    expect(node.querySelector('.katex [style]')).not.toBeNull();
    expect(node.querySelector('math')).not.toBeNull();
  });
  it('mantém o conteúdo recolhível dentro de details e HTML inline balanceado', () => {
    const node = parse('<details>\n<summary>Abrir</summary>\n\nTexto **dentro**.\n\n</details>\n\nUse <kbd>Ctrl</kbd>.');
    expect(node.querySelector('details strong')?.textContent).toBe('dentro');
    expect(node.querySelector('kbd')?.textContent).toBe('Ctrl');
  });
  it('bloqueia scripts, handlers, iframes, estilos e links executáveis', () => {
    const node = parse('<script>alert(1)</script>\n\n<img src="a.png" onerror="alert(1)">\n\n<iframe src="https://evil.test"></iframe>\n\n<a href="javascript:alert(1)" style="position:fixed">link</a>');
    expect(node.querySelector('script,iframe,[onerror],[style],a[href^="javascript"]')).toBeNull();
  });
  it('destaca código conhecido e escapa linguagens desconhecidas', () => {
    const node = parse('~~~javascript\nconst x = 1;\n~~~\n\n~~~desconhecida\n<script>alert(1)</script>\n~~~');
    expect(node.querySelector('.hljs-keyword')).not.toBeNull();
    expect(node.querySelector('script')).toBeNull();
    expect(node.querySelectorAll('button.copy-code')).toHaveLength(2);
  });
  it('gera índice com âncoras únicas e interpreta avisos', () => {
    const result = renderMarkdown('# Título\n\n## Repetido\n\n## Repetido\n\n> [!TIP]\n> Uma dica.');
    expect(new Set(result.headings.map(heading => heading.id)).size).toBe(3);
    expect(result.html).toContain('callout-tip');
    expect(result.html).toContain('Uma dica.');
  });
  it('separa frontmatter com BOM e CRLF e prepara imagens locais', () => {
    const result = renderMarkdown('\uFEFF---\r\nautor: "Ana"\r\n---\r\n\r\n# Texto\r\n\r\n![Foto](./imagens/foto.png)');
    expect(result.metadata.autor).toBe('Ana');
    expect(result.html).not.toContain('autor:');
    expect(result.html).toContain('data-local-src="./imagens/foto.png"');
  });
});
