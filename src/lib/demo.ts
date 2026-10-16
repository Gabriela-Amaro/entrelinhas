import type { Workspace, DocumentFile } from '../types';

const welcome = `---
título: Seu espaço de leitura
autor: Entrelinhas
---

# Boas-vindas ao Entrelinhas

Um lugar tranquilo para ler, explorar e conectar suas ideias. Seus arquivos Markdown, **com espaço para tudo**.

> [!TIP]
> Abra uma pasta ou arraste seus arquivos para cá. Na próxima vez, sua leitura continua exatamente de onde parou.

## Sua leitura, do seu jeito

Documentação de um projeto, anotações de estudo ou aquele segundo cérebro que não para de crescer. Abra quantos documentos quiser, alterne entre as abas e coloque duas leituras **lado a lado**.

- **Abas de verdade.** Cada documento mantém sua posição de leitura.
- **Pastas organizadas.** Navegue pela estrutura original dos seus arquivos.
- **Tudo no lugar.** Abas, tema e posição são salvos automaticamente.
- **Local por natureza.** Nenhuma conta e nenhum upload dos seus documentos.

## Ideias que ganham forma

Diagramas Mermaid aparecem diretamente na página. Fluxos, sequências, cronogramas e muito mais.

~~~mermaid
flowchart LR
    A[Uma ideia] --> B[Algumas notas]
    B --> C[Novas conexões]
    C --> D[Algo incrível]
~~~

## Mais que texto

De pequenos trechos de código a fórmulas matemáticas, o Markdown tem muito a oferecer.

~~~typescript
const leitura = {
  arquivos: 'quantos você quiser',
  diagramas: 'Mermaid',
  continuarDeOndeParou: true,
};

console.log('Pode chegar. A casa é sua.');
~~~

### Matemática sem complicação

A beleza também está nos detalhes: $e^{i\\pi} + 1 = 0$.

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

### Uma visão organizada

| Recurso | Pronto para ler |
| :--- | :---: |
| Tabelas e listas de tarefas | ✓ |
| Diagramas Mermaid | ✓ |
| Fórmulas com KaTeX | ✓ |
| Código com destaque | ✓ |
| Notas de rodapé e avisos | ✓ |

## Pequenos atalhos

- [x] Encontrar um lugar para suas leituras
- [ ] Abrir seus primeiros arquivos com **Ctrl + O**
- [ ] Experimentar dois documentos lado a lado
- [ ] Fechar o app e voltar quando quiser

Use **Ctrl + F** para encontrar um trecho e o índice à direita para ir direto ao que interessa. Explore também o [guia de Markdown](./Guia%20de%20Markdown.md).

---

Feito para ler com calma. E para não perder o fio da meada.[^1]

[^1]: Este é um documento de exemplo. Edições e tarefas ficam guardadas na sessão. Use Ctrl+S para salvar no arquivo.
`;

const guide = `# Guia de Markdown

Seu repertório de formatação, reunido em um só lugar.

## Texto e links

**Negrito**, *itálico*, ~~riscado~~, ==destaque==, ++inserido++, H~2~O e x^2^.

Links como [Markdown Guide](https://www.markdownguide.org) e URLs automáticas: https://example.com.

## Avisos

> [!NOTE]
> Notas ajudam a guardar informações úteis.

> [!WARNING]
> HTML é sanitizado. Scripts, iframes e conteúdo executável não são executados.

> [!IMPORTANT]
> Extensões específicas de plataformas, como componentes MDX, precisam de suporte próprio. Este leitor não executa componentes JavaScript.

## Diagramas de sequência

~~~mermaid
sequenceDiagram
    actor Você
    participant App as Entrelinhas
    Você->>App: Abrir vários arquivos
    App-->>Você: Uma aba para cada um
    Você->>App: Fechar o aplicativo
    App->>App: Guardar a sessão
    Você->>App: Voltar depois
    App-->>Você: Tudo como você deixou
~~~

## Listas e definições

1. Abra uma pasta.
2. Escolha um arquivo na barra lateral.
3. Continue explorando.

Markdown
: Um jeito simples de escrever textos bem estruturados.

Entrelinhas
: Um espaço dedicado à leitura desses textos.

## Detalhes recolhíveis

<details>
<summary>Um pouco mais sobre os arquivos</summary>

Use o botão Editar para modificar o Markdown e Ctrl+S para salvar. Imagens relativas funcionam quando estão dentro da pasta aberta ou ao lado do documento no desktop. No navegador, importe a pasta para incluir as imagens.

</details>

## Fórmulas

Em linha: $a^2 + b^2 = c^2$.

Em bloco:

$$
f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n
$$

## Notas de rodapé

Um pensamento pode ter um complemento.[^nota]

[^nota]: E o complemento fica aqui, sem interromper a leitura.

## Voltar ao começo

Abra as [boas-vindas](./Boas-vindas.md) em outra aba e experimente o botão **Lado a lado**.
`;

export const demoDocuments: DocumentFile[] = [
  { id: 'demo/welcome', name: 'Boas-vindas.md', path: 'exemplos/Boas-vindas.md', content: welcome, rootId: 'examples' },
  { id: 'demo/guide', name: 'Guia de Markdown.md', path: 'exemplos/Guia de Markdown.md', content: guide, rootId: 'examples' },
];
export function initialWorkspace(): Workspace {
  return {
    version: 1, documents: demoDocuments,
    roots: [{ id: 'examples', name: 'Primeiros passos', path: 'exemplos' }],
    tabs: demoDocuments.map(doc => doc.id), activeId: demoDocuments[0].id, secondaryId: null,
    scroll: {}, expanded: ['examples'], theme: 'dark', fontSize: 16, sidebar: true, outline: true, source: false,
  };
}
