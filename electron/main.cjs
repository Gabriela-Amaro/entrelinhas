const { app, BrowserWindow, dialog, ipcMain, protocol, net, shell, Menu } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');

app.setName('Entrelinhas');
if (!process.env.ENTRELINHAS_SMOKE) app.setPath('userData', path.join(app.getPath('appData'), 'Entrelinhas'));

protocol.registerSchemesAsPrivileged([{ scheme: 'md-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const MARKDOWN = /\.(md|markdown|mdown|mkd)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp)$/i;
const MAX_FILE = 20 * 1024 * 1024;
let mainWindow, sessionPath, closing = false, pending = null;
const allowedFiles = new Set();
const allowedRoots = new Set();
const assetRoots = new Set();

function inside(file, root) {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function authorized(file) { return allowedFiles.has(file) || [...allowedRoots].some(root => inside(file, root)); }
async function readMarkdown(file) {
  const canonical = await fsp.realpath(file);
  if (!authorized(canonical) || !MARKDOWN.test(canonical)) throw new Error('Arquivo não autorizado. Abra-o pelo seletor de arquivos.');
  if ((await fsp.stat(canonical)).size > MAX_FILE) throw new Error('O arquivo excede o limite de 20 MB.');
  return fsp.readFile(canonical, 'utf8');
}
async function atomicWrite(file, content) {
  if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > MAX_FILE) throw new Error('O documento excede o limite de 20 MB.');
  const temporary = path.join(path.dirname(file), `.entrelinhas-${randomUUID()}.tmp`);
  let handle;
  try {
    const mode = await fsp.stat(file).then(stat => stat.mode, error => { if (error.code === 'ENOENT') return 0o666; throw error; });
    handle = await fsp.open(temporary, 'wx', mode);
    await handle.writeFile(content, 'utf8');
    await handle.sync(); await handle.close(); handle = null;
    await fsp.rename(temporary, file);
  } finally { await handle?.close(); await fsp.unlink(temporary).catch(() => {}); }
}
const documentWrites = new Map();
async function writeMarkdown(file, content, expectedContent) {
  const canonical = await fsp.realpath(file);
  const previous = documentWrites.get(canonical) || Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    const current = await readMarkdown(canonical);
    if (typeof expectedContent !== 'string' || current !== expectedContent) throw new Error('O arquivo foi alterado por outro programa. Seu rascunho foi mantido; use Salvar como para guardar uma cópia.');
    await atomicWrite(canonical, content);
  });
  documentWrites.set(canonical, write);
  try { await write; } finally { if (documentWrites.get(canonical) === write) documentWrites.delete(canonical); }
}
async function importPaths(paths) {
  const result = { documents: [], roots: [], warnings: [] };
  for (const input of paths) {
    try {
      const canonical = await fsp.realpath(input);
      const stat = await fsp.stat(canonical);
      if (stat.isDirectory()) {
        allowedRoots.add(canonical); assetRoots.add(canonical);
        const root = { id: canonical, name: path.basename(canonical), path: canonical, native: true };
        result.roots.push(root);
        async function walk(directory) {
          for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
            if (result.documents.length >= 5000) return;
            if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'vendor'].includes(entry.name)) await walk(path.join(directory, entry.name));
            else if (entry.isFile() && MARKDOWN.test(entry.name)) {
              const file = path.join(directory, entry.name);
              try { result.documents.push({ id: file, name: entry.name, path: file, rootId: root.id, content: await readMarkdown(file), native: true }); }
              catch (error) { result.warnings.push(`${entry.name}: ${error.message}`); }
            }
          }
        }
        await walk(canonical);
        if (result.documents.length >= 5000) result.warnings.push('Limite de 5.000 arquivos por importação atingido.');
      } else if (MARKDOWN.test(canonical)) {
        allowedFiles.add(canonical); assetRoots.add(path.dirname(canonical));
        result.documents.push({ id: canonical, name: path.basename(canonical), path: canonical, content: await readMarkdown(canonical), native: true });
      }
    } catch (error) { result.warnings.push(`${path.basename(input)}: ${error.message}`); }
  }
  result.documents.sort((a, b) => a.path.localeCompare(b.path, 'pt-BR', { numeric: true }));
  return result;
}
function loadSession() {
  try {
    const state = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    if (state.version !== 1 || !Array.isArray(state.documents) || !Array.isArray(state.roots)) return null;
    for (const root of state.roots) if (root.native) { allowedRoots.add(root.path); assetRoots.add(root.path); }
    for (const doc of state.documents) if (doc.native) { allowedFiles.add(doc.path); assetRoots.add(path.dirname(doc.path)); }
    return state;
  } catch { return null; }
}
function saveSession(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.documents) || !Array.isArray(state.roots)) throw new Error('Sessão inválida');
  if (state.documents.some(doc => doc.native && !authorized(doc.path)) || state.roots.some(root => root.native && !allowedRoots.has(root.path))) throw new Error('Caminho não autorizado');
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(`${sessionPath}.tmp`, JSON.stringify(state));
  fs.renameSync(`${sessionPath}.tmp`, sessionPath);
}
function trusted(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw new Error('Origem não autorizada');
}
function command(value) { mainWindow?.webContents.send('command', value); }
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 780, minHeight: 560,
    show: !process.env.ENTRELINHAS_SMOKE,
    backgroundColor: '#191b1a', title: 'Entrelinhas', icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  mainWindow.on('close', event => {
    if (closing) return;
    event.preventDefault(); closing = true; command('flush-session');
    setTimeout(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy(); }, 1500);
  });
  mainWindow.on('closed', () => { mainWindow = null; closing = false; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'Arquivo', submenu: [
      { label: 'Abrir arquivos…', accelerator: 'CmdOrCtrl+O', click: () => command('open-files') },
      { label: 'Abrir pasta…', accelerator: 'CmdOrCtrl+Shift+O', click: () => command('open-folder') },
      { label: 'Salvar documento', accelerator: 'CmdOrCtrl+S', click: () => command('save-document') },
      { label: 'Salvar como…', accelerator: 'CmdOrCtrl+Shift+S', click: () => command('save-document-as') },
      { type: 'separator' }, { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Editar', submenu: [{ label: 'Alternar edição', accelerator: 'CmdOrCtrl+E', click: () => command('edit') }, { type: 'separator' }, { role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' }, { role: 'cut', label: 'Recortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' }, { label: 'Buscar no documento', accelerator: 'CmdOrCtrl+F', click: () => command('find') }] },
    { label: 'Visualizar', submenu: [
      { label: 'Leitura lado a lado', accelerator: 'CmdOrCtrl+\\', click: () => command('split') },
      { label: 'Alternar tema', click: () => command('theme') },
      { type: 'separator' }, { label: 'Focar documento (F)', click: () => command('focus-document') },
      ...(!app.isPackaged ? [{ role: 'toggleDevTools', label: 'Ferramentas de desenvolvimento' }] : []),
    ] },
  ]));
  if (process.env.VITE_DEV_SERVER_URL) await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', async (_event, argv) => {
    mainWindow?.show(); mainWindow?.focus();
    const paths = argv.slice(1).filter(arg => !arg.startsWith('-') && MARKDOWN.test(arg));
    if (paths.length) mainWindow?.webContents.send('open-result', await importPaths(paths));
  });
  app.on('open-file', async (event, file) => { event.preventDefault(); const result = await importPaths([file]); if (mainWindow) mainWindow.webContents.send('open-result', result); else pending = result; });
  app.whenReady().then(async () => {
    sessionPath = path.join(app.getPath('userData'), 'workspace.json');
    protocol.handle('md-asset', async request => {
      try {
        const url = new URL(request.url);
        const file = await fsp.realpath(url.searchParams.get('path') || '');
        if (!IMAGE.test(file) || ![...assetRoots].some(root => inside(file, root))) return new Response('Acesso negado', { status: 403 });
        return net.fetch(pathToFileURL(file).href);
      } catch { return new Response('Imagem não encontrada', { status: 404 }); }
    });
    ipcMain.handle('files:pick', async event => {
      trusted(event);
      const selected = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }] });
      return selected.canceled ? null : importPaths(selected.filePaths);
    });
    ipcMain.handle('folder:pick', async event => {
      trusted(event);
      const selected = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
      return selected.canceled ? null : importPaths(selected.filePaths);
    });
    ipcMain.handle('document:read', (event, file) => { trusted(event); return readMarkdown(file); });
    ipcMain.handle('document:write', (event, file, content, expected) => { trusted(event); return writeMarkdown(file, content, expected); });
    ipcMain.handle('document:save-as', async (event, name, content) => {
      trusted(event);
      const selected = await dialog.showSaveDialog(mainWindow, { defaultPath: path.basename(String(name)), filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }] });
      if (selected.canceled || !selected.filePath) return null;
      let file = path.resolve(selected.filePath);
      if (!MARKDOWN.test(file)) file += '.md';
      // A chosen symlink refers to the selected target; an atomic rename must not
      // silently replace the link itself.
      file = await fsp.realpath(file).catch(error => { if (error.code === 'ENOENT') return file; throw error; });
      await atomicWrite(file, content);
      allowedFiles.add(file); assetRoots.add(path.dirname(file));
      return { id: file, path: file, name: path.basename(file), content, native: true };
    });
    ipcMain.handle('session:load', event => { trusted(event); return loadSession(); });
    ipcMain.handle('session:save', (event, state) => { trusted(event); saveSession(state); });
    ipcMain.handle('session:close', (event, state) => { trusted(event); saveSession(state); if (closing) mainWindow?.destroy(); });
    ipcMain.handle('files:pending', event => { trusted(event); const result = pending; pending = null; return result; });
    ipcMain.handle('external:open', async (event, input) => {
      trusted(event);
      const url = new URL(input);
      if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error('Protocolo não permitido');
      await shell.openExternal(url.href);
    });
    const paths = process.argv.slice(1).filter(arg => !arg.startsWith('-') && MARKDOWN.test(arg));
    if (paths.length) pending = await importPaths(paths);
    await createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
