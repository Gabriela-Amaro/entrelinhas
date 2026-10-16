# Contribuir

Instale Node.js 22.12 ou superior (CI usa Node.js 24), execute `npm ci` e depois `npm run desktop`. O modo web usa `npm run dev`.

Antes de enviar uma alteração:

```sh
npm run typecheck
npm test
npm run test:desktop
```

O teste desktop usa uma pasta temporária e não modifica sua sessão nem seus documentos. No CI Linux, roda em Xvfb. Abra uma issue para explicar um problema de instalação ou uma funcionalidade nova. Prefira exemplos mínimos de Markdown.

## Publicar uma versão (mantenedora)

1. Atualize a versão de `package.json` e o lockfile: `npm version minor --no-git-tag-version` (ou `patch`).
2. Atualize `docs/RELEASE_NOTES.md` com as mudanças e confirme que os testes passam.
3. Faça commit, crie a tag correspondente (`git tag v1.2.1`) e envie branch e tag ao GitHub.
4. O workflow **Publicar instaladores** testa o app, gera os pacotes em Linux, Windows e macOS e publica a release com hashes SHA-256.

O `GITHUB_TOKEN` automático do workflow publica os arquivos; não precisa de token pessoal no código. Certificados de Windows e credenciais Apple para assinatura/notarização devem ser configurados separadamente quando estiverem disponíveis.

Versões de Actions estão fixadas por SHA. O projeto não envia `node_modules`, builds, sessões, arquivos do usuário nem chaves ao repositório. A licença do código é MIT; os avisos das bibliotecas e fontes são incluídos no aplicativo durante o build.
