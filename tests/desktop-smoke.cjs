// Runs against the actual Electron app, with native dialogs replaced by fixtures.
// The runner uses an isolated userData directory, never the user's real session.
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
app.setPath('userData', process.env.ENTRELINHAS_TEST_DATA);
const fixture = path.join(process.env.ENTRELINHAS_TEST_DATA, 'fixtures/pasta');
if (!fs.existsSync(fixture)) fs.cpSync(path.resolve(__dirname, 'fixtures/pasta'), fixture, { recursive: true });
const phase = process.env.ENTRELINHAS_TEST_PHASE;
dialog.showOpenDialog = async (_window, options) => ({ canceled: false,
  filePaths: options.properties.includes('openDirectory') ? [fixture] : [path.join(fixture, 'Primeiro.md'), path.join(fixture, 'Segundo.md')],
});
require('../electron/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const timeout = setTimeout(() => { console.error('Desktop smoke test timed out'); app.exit(1); }, 45000);
app.whenReady().then(async () => {
  try {
    let window;
    for (let i = 0; i < 150; i++) {
      window = BrowserWindow.getAllWindows()[0];
      if (window && await window.webContents.executeJavaScript('!!document.querySelector(".app")').catch(() => false)) break;
      await delay(100);
    }
    assert.ok(window, 'janela criada');
    const evaluate = async expression => {
      try { return await window.webContents.executeJavaScript(expression); }
      catch (error) { console.error('Falha ao avaliar:', expression.slice(0, 180)); throw error; }
    };
    async function waitFor(expression) {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
      throw new Error(`Condição não atingida: ${expression}`);
    }
    if (phase === 'open') {
      assert.equal(await evaluate('typeof window.desktop.pickFiles'), 'function', 'preload disponível');
      await evaluate('document.querySelector(".open-button").click()');
      await waitFor('document.querySelectorAll("[role=tab]").length === 4');
      await evaluate('document.querySelector(".add-folder").click()');
      await waitFor('[...document.querySelectorAll(".root-toggle")].some(n=>n.textContent==="pasta")');
      await waitFor('document.querySelector(".reader-pane img")?.naturalWidth === 480');
      await waitFor('!!document.querySelector(".mermaid-block svg")');
      await waitFor('document.querySelector(".mermaid-block svg")?.textContent.includes("Abrir")');
      assert.equal(await evaluate('!!document.querySelector(".open-files")'), false);
      await evaluate('document.querySelector(".edit-toggle").click()');
      await waitFor('!!document.querySelector(".markdown-editor")');
      const original = fs.readFileSync(path.join(fixture, 'Primeiro.md'), 'utf8');
      const edited = original + '\n- [ ] Tarefa editável\n';
      await evaluate(`(() => { const input = document.querySelector('.markdown-editor'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(edited)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true })); })()`);
      assert.equal(await evaluate('!!document.querySelector(".focus-mode")'), false, 'F no editor continua digitando');
      await evaluate('document.querySelector(".edit-toggle").click()');
      await waitFor('!!document.querySelector(".task-list-item-checkbox")');
      await evaluate('document.querySelector(".task-list-item-checkbox").click()');
      await waitFor('document.querySelector(".task-list-item-checkbox").checked');
      await evaluate('document.querySelector(".save-document").click()');
      await waitFor('!document.querySelector(".unsaved-dot")');
      assert.ok(fs.readFileSync(path.join(fixture, 'Primeiro.md'), 'utf8').includes('- [x] Tarefa editável'));
      const boundsBeforeFocus = window.getBounds();
      await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }))`);
      await waitFor('!!document.querySelector(".focus-mode")');
      assert.equal(window.isFullScreen(), false, 'foco mantém a janela normal');
      assert.deepEqual(window.getBounds(), boundsBeforeFocus, 'dimensões da janela preservadas');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.app-header')).display`), 'none');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.sidebar')).display`), 'none');
      assert.equal(await evaluate(`document.querySelector('.reader-pane').getBoundingClientRect().top`), 0);
      await evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
      await waitFor('!document.querySelector(".focus-mode")');
      assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.sidebar')).display`), 'none');
      await evaluate('document.querySelector(".edit-toggle").click()');
      const draft = edited.replace('[ ]', '[x]') + '\nRascunho preservado após reabrir.\n\n' + Array.from({ length: 20 }, (_, index) => `Parágrafo ${index + 1} para validar a posição de leitura após reabrir.`).join('\n\n');
      await evaluate(`(() => { const input = document.querySelector('.markdown-editor'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(draft)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await evaluate('document.querySelector(".edit-toggle").click()');
      await evaluate(`document.querySelector('.toolbar-actions button[title^="Ler dois"]').click()`);
      await waitFor('document.querySelectorAll(".reader-pane").length === 2');
      await waitFor('document.querySelector(".reader-scroll")?.dataset.ready === "true"');
      await evaluate(`document.querySelector('.reader-scroll').scrollTop = 250; document.querySelector('.reader-scroll').dispatchEvent(new Event('scroll')); document.querySelector('.theme-toggle').click();`);
      await delay(400);
      const session = JSON.parse(fs.readFileSync(path.join(process.env.ENTRELINHAS_TEST_DATA, 'workspace.json'), 'utf8'));
      assert.equal(session.tabs.length, 4);
      assert.equal(session.theme, 'light');
      assert.ok(session.secondaryId);
      assert.ok(session.scroll[session.activeId] > 0, JSON.stringify(await evaluate(`({ height:document.querySelector('.reader-scroll').scrollHeight,client:document.querySelector('.reader-scroll').clientHeight,top:document.querySelector('.reader-scroll').scrollTop,ready:document.querySelector('.reader-scroll').dataset.ready })`)));
      await evaluate(`window.__focusReader = document.querySelector('.reader-pane'); document.querySelector('.fullscreen-toggle').click()`);
      await waitFor('!!document.querySelector(".focus-mode")');
      assert.equal(await evaluate(`getComputedStyle(document.querySelector('.secondary-pane')).display`), 'none');
      assert.equal(await evaluate(`window.__focusReader === document.querySelector('.reader-pane')`), true, 'leitor preservado durante o foco');
      await evaluate(`document.querySelector('.focus-exit').click()`);
      await waitFor('!document.querySelector(".focus-mode")');
      assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.secondary-pane')).display`), 'none');
      assert.equal(await evaluate(`window.__focusReader === document.querySelector('.reader-pane')`), true);
      const blocked = await evaluate(`window.desktop.readDocument('/etc/passwd').then(()=>false,()=>true)`);
      assert.equal(blocked, true, 'leitura fora da seleção bloqueada');
      const blockedWrite = await evaluate(`window.desktop.writeDocument('/etc/passwd', 'alterado', '').then(()=>false,()=>true)`);
      assert.equal(blockedWrite, true, 'escrita fora da seleção bloqueada');
      const externalFile = path.join(fixture, 'Segundo.md');
      const externalOriginal = fs.readFileSync(externalFile, 'utf8');
      fs.appendFileSync(externalFile, '\nAlterado por outro editor.\n');
      const conflict = await evaluate(`window.desktop.writeDocument(${JSON.stringify(externalFile)}, 'não substituir', ${JSON.stringify(externalOriginal)}).then(()=>false,()=>true)`);
      assert.equal(conflict, true, 'conflito externo preservado');
      assert.ok(fs.readFileSync(externalFile, 'utf8').endsWith('Alterado por outro editor.\n'));
      const blockedImage = await evaluate(`fetch('md-asset://local/image?path=%2Fetc%2Fpasswd').then(r=>r.status,()=>403)`);
      assert.equal(blockedImage, 403, 'protocolo restringe os arquivos');
      const savedFile = path.join(process.env.ENTRELINHAS_TEST_DATA, 'expected.json');
      fs.writeFileSync(savedFile, JSON.stringify({ id: session.activeId, scroll: session.scroll[session.activeId] }));
      console.log('PASS: seleção múltipla, pasta, Mermaid, edição, tarefas, salvamento, foco no documento com F/Esc, restauração dos painéis e conflitos externos');
    } else {
      await waitFor('document.querySelectorAll(".reader-pane").length === 2');
      await waitFor('!!document.querySelector(".mermaid-block svg")');
      const expected = JSON.parse(fs.readFileSync(path.join(process.env.ENTRELINHAS_TEST_DATA, 'expected.json'), 'utf8'));
      await waitFor('document.querySelector(".reader-scroll")?.dataset.ready === "true"');
      const actual = await evaluate(`({ theme:document.documentElement.dataset.theme, id:document.querySelector('.reader-pane').dataset.document, scroll:document.querySelector('.reader-scroll').scrollTop, tabs:document.querySelectorAll('[role=tab]').length })`);
      assert.equal(actual.theme, 'light'); assert.equal(actual.id, expected.id); assert.equal(actual.tabs, 4);
      assert.ok(Math.abs(actual.scroll - expected.scroll) < 5, `rolagem restaurada: ${actual.scroll} / ${expected.scroll}`);
      assert.equal(await evaluate('document.querySelector(".markdown-body").textContent.includes("Rascunho preservado após reabrir.")'), true);
      assert.equal(fs.readFileSync(path.join(fixture, 'Primeiro.md'), 'utf8').includes('Rascunho preservado após reabrir.'), false);
      console.log('PASS: sessão restaurada em um segundo processo Electron');
    }
    clearTimeout(timeout); window.close();
  } catch (error) { clearTimeout(timeout); console.error(error); app.exit(1); }
});
