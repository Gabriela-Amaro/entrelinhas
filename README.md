# Entrelinhas

[![Verificações](https://github.com/Gabriela-Amaro/entrelinhas/actions/workflows/ci.yml/badge.svg)](https://github.com/Gabriela-Amaro/entrelinhas/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Gabriela-Amaro/entrelinhas)](https://github.com/Gabriela-Amaro/entrelinhas/releases/latest)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green.svg)](LICENSE)

Leitor e editor local de Markdown com **várias abas**, **dois documentos lado a lado**, **Mermaid**, **fórmulas matemáticas** e **retomada da sessão**. Interface em português, temas claro/escuro e foco só no texto com **F**. Sem conta e sem enviar seus documentos para um servidor.

## Instalar e abrir pelo menu

**[Baixe os instaladores na página de Releases](https://github.com/Gabriela-Amaro/entrelinhas/releases/latest).** Não precisa instalar Node.js, npm, Git ou clonar o projeto para usar o aplicativo.

| Seu sistema | Arquivo da release | Instalação |
| --- | --- | --- |
| Ubuntu, Debian e derivados x64 | `.deb` | Abra no instalador de aplicativos ou use `sudo apt install ./Entrelinhas-*-linux-amd64.deb`. |
| Fedora e derivados x64 | `.rpm` | Abra no instalador de aplicativos ou use `sudo dnf install ./Entrelinhas-*-linux-x86_64.rpm`. |
| Outros Linux x64, ou sem sudo | `Entrelinhas-*-linux-x64.tar.gz` | Extraia e execute `sh install.sh` dentro da pasta extraída. |
| Windows x64 | `Entrelinhas-*-windows-x64-setup.exe` | Execute o instalador. Ele cria a entrada no menu Iniciar. |
| macOS Intel | `Entrelinhas-*-macos-x64.dmg` | Abra o DMG e arraste Entrelinhas para Aplicativos. |
| macOS Apple Silicon | `Entrelinhas-*-macos-arm64.dmg` | Abra o DMG e arraste Entrelinhas para Aplicativos. |

Depois de instalar, procure **Entrelinhas** na busca do sistema. No Linux, também aparece na categoria **Escritório**; no Windows, no menu **Iniciar**; no macOS, no **Spotlight**. No Linux e Windows, pode ser escolhido em **Abrir com** para arquivos Markdown. O aplicativo não altera à força o seu editor padrão.

O AppImage também está disponível para uso portátil. Um AppImage sozinho não cria o atalho no menu; use os instaladores da tabela para isso. O pacote Linux `.tar.gz` inclui o aplicativo completo e não depende de FUSE.

Nesta versão, os pacotes Windows e macOS não têm certificado de assinatura/notarização. A abertura pode depender das políticas de segurança do sistema.

### Linux sem sudo: passo a passo

1. Baixe o arquivo `Entrelinhas-<versão>-linux-x64.tar.gz` da release.
2. Extraia pelo gerenciador de arquivos.
3. Abra um terminal **na pasta extraída**, onde estão `install.sh`, `VERSION` e `app`.
4. Execute:

```sh
sh install.sh
```

O instalador coloca o programa em `~/.local/share/entrelinhas`, registra o ícone e cria a entrada em `~/.local/share/applications`. Respeita `XDG_DATA_HOME` quando definido. Também cria `~/.local/bin/entrelinhas`. Você pode apagar a pasta extraída depois; guarde o `uninstall.sh` se quiser desinstalar mais tarde.

Para atualizar, baixe a nova versão e execute `sh install.sh` novamente com o aplicativo fechado. Para remover a instalação sem sudo, execute `sh uninstall.sh`. A sessão e seus documentos são preservados. As versões anteriores do executável permanecem em `~/.local/share/entrelinhas/versions` até a desinstalação.

Pacotes `.deb` e `.rpm` são atualizados e removidos pelo gerenciador de aplicativos da distribuição. Não misture a instalação por pacote com a instalação sem sudo; escolha uma das formas.

### Verificar o download

Cada release inclui `SHA256SUMS.txt`. No Linux, na pasta dos downloads:

```sh
sha256sum --ignore-missing -c SHA256SUMS.txt
```

## Leitura e organização

- **Abrir arquivos** aceita vários Markdown em uma seleção e cria uma aba para cada um.
- **Abrir pasta**, no menu ao lado do botão Abrir arquivos, adiciona a árvore ao explorador. A biblioteca também tem o botão **Adicionar pasta**. Só o primeiro documento abre imediatamente; os demais ficam disponíveis para abrir quando precisar.
- Arquivos e pastas também podem ser arrastados para a janela. Nesse caso, são importadas cópias para leitura; para manter a ligação com o arquivo original no desktop, use o seletor nativo.
- **Lado a lado** mantém dois documentos visíveis, com rolagens independentes. O seletor no topo do segundo painel permite escolher qualquer outra aba aberta.
- O app guarda biblioteca, abas, aba ativa, segundo painel, pastas expandidas, rolagens, tema, tamanho da fonte, índice e modo de código-fonte, modo de edição e rascunhos.
- A busca destaca o texto encontrado. Enter avança; Shift+Enter volta.
- O índice navega pelos títulos. Preferências permitem ajustar o texto e visualizar o Markdown original.
- Diagramas têm ampliação, zoom e movimento por arraste. Blocos de código têm botão de copiar.
- **Editar** (Ctrl+E) abre o editor Markdown. O botão **Ler** retorna à visualização formatada.
- **Checkboxes** alteram a tarefa correspondente no Markdown, inclusive em listas aninhadas e citações.
- **Ctrl+S** salva no arquivo original no desktop. Documentos de exemplo e cópias importadas usam o seletor **Salvar como**. No navegador, o botão baixa uma cópia `.md`. **Ctrl+Shift+S** abre Salvar como no desktop.
- Rascunhos são guardados na sessão, mesmo antes de salvar no arquivo. Um ponto na aba identifica alterações pendentes.
- O botão **Focar documento** e a tecla **F** mostram apenas o documento ativo na área do aplicativo, ocultando biblioteca, abas, barras, índice e o segundo painel. **Esc** ou o botão discreto no canto superior direito restauram a interface e os painéis anteriores. O tamanho da janela permanece igual. F continua digitando normalmente no editor e nos campos de busca.

## Formatos suportados

Markdown CommonMark, tabelas, listas de tarefas, texto riscado, links automáticos, código com destaque por linguagem, todos os tipos de diagrama incluídos no Mermaid instalado, matemática em linha (`$...$`) e em bloco (`$$...$$`) com KaTeX, notas de rodapé, emojis por shortcode, listas de definições, subscrito, sobrescrito, `==destaque==`, `++inserido++`, avisos GitHub (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`), HTML sanitizado e detalhes recolhíveis. O frontmatter YAML simples é separado do corpo do documento.

Links relativos para outros Markdown funcionam entre os documentos da biblioteca, inclusive com âncoras. Imagens relativas no desktop podem estar nas pastas abertas ou ao lado dos arquivos selecionados. No navegador, abra a pasta inteira para importar também as imagens. Imagens remotas usam a conexão com a internet.

“Todo Markdown” não é um padrão único: MDX/JSX, execução de JavaScript, embeds com iframe, PlantUML e extensões exclusivas de outras plataformas não são executados. Um Mermaid inválido mostra o código e o erro sem impedir a leitura do restante do documento.

## Atalhos

| Ação | Atalho |
| --- | --- |
| Abrir arquivos | Ctrl+O |
| Abrir pasta | Ctrl+Shift+O |
| Buscar no documento/editor | Ctrl+F |
| Alternar edição e leitura | Ctrl+E |
| Salvar documento | Ctrl+S |
| Salvar como (desktop) | Ctrl+Shift+S |
| Focar documento / sair | F / Esc |
| Fechar aba | Ctrl+W |
| Próxima aba / anterior | Ctrl+Tab / Ctrl+Shift+Tab |
| Lado a lado | Ctrl+\ |
| Aumentar / diminuir texto | Ctrl++ / Ctrl+- |

No macOS, use Command no lugar de Ctrl.

## Sessão e limites

No Linux, o desktop guarda a sessão em `~/.config/Entrelinhas/workspace.json` (ou no diretório de configuração definido pelo sistema). Em outros sistemas, usa a pasta de dados do aplicativo. A escrita é feita por arquivo temporário e renomeação para evitar sessões parcialmente gravadas. Os testes desktop usam uma pasta temporária independente.

Rascunhos não são substituídos por releituras do disco ou reimportações da pasta. Ao salvar, o app compara o arquivo com o conteúdo original: se outro editor tiver alterado o arquivo, mantém ambas as versões e permite salvar o rascunho como uma cópia. A escrita dos documentos também usa arquivo temporário e renomeação.

Se um documento aberto for removido ou ficar indisponível no disco, a última cópia salva continua legível com um aviso. Para atualizar a lista de uma pasta após adicionar/remover arquivos em outro programa, abra a pasta novamente. Cada importação desktop aceita até 5.000 Markdown e cada arquivo pode ter até 20 MB. Pastas ocultas, `node_modules`, `vendor` e links simbólicos dentro da árvore são ignorados.

## Desenvolver e empacotar

Requer **Node.js 22.12 ou superior** e npm. O CI usa Node.js 24.

```sh
git clone https://github.com/Gabriela-Amaro/entrelinhas.git
cd entrelinhas
npm ci
npm run desktop
```

`npm run desktop` abre o Electron com atualização automática. Para apenas o navegador, use `npm run dev` e abra `http://localhost:5173`. A versão web importa cópias e mantém os documentos e imagens no IndexedDB do navegador. No desktop, o app lê e salva os arquivos selecionados no disco.

```sh
npm run typecheck       # TypeScript
npm test                # Markdown, abas, sessão e instalação Linux isolada
npm run test:desktop    # Electron real: arquivos, edição, foco e reabertura
npm run pack            # aplicativo extraído em release/
npm run dist:linux      # AppImage, DEB, RPM e tar.gz com instalador
npm run dist:win        # instalador NSIS; execute no Windows
npm run dist:mac        # DMG; execute no macOS
npm run install:desktop # instala o build Linux local no menu
npm run checksums       # hashes dos instaladores locais
```

Os testes desktop usam diretório temporário, sem modificar a sua sessão nem os documentos originais. No CI, rodam em Xvfb. Os instaladores precisam ser gerados no sistema correspondente; o GitHub Actions faz isso automaticamente para Linux x64, Windows x64 e macOS Intel/Apple Silicon.

## Publicar uma nova versão

O workflow [Publicar instaladores](.github/workflows/release.yml) é executado quando uma tag `v<versão>` é enviada. Ele verifica o código, gera os instaladores nos sistemas correspondentes e publica a release completa com hashes SHA-256. Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para o procedimento.

## Estrutura

- `src/components/`: leitor, editor e biblioteca.
- `src/lib/`: renderização de Markdown, importação, abas, caminhos e sessão.
- `electron/`: seletores nativos, leitura/escrita autorizada, imagens locais e sessão.
- `packaging/linux/`: instalação e desinstalação sem sudo e sem Node.js.
- `scripts/`: empacotamento, licenças das dependências e testes desktop.
- `.github/workflows/`: verificações e publicação dos instaladores.

## Licença

O código do Entrelinhas está sob a [licença MIT](LICENSE). Fontes e bibliotecas mantêm suas licenças originais. O build inclui `THIRD_PARTY_NOTICES.txt` com os avisos das dependências; Electron e Chromium também distribuem seus próprios avisos.

Electron executa a interface com isolamento de contexto e sandbox. A ponte expõe operações específicas, sem acesso genérico ao Node pelo Markdown. Links externos aceitam apenas HTTP, HTTPS e mailto; imagens locais são restritas às pastas selecionadas.
