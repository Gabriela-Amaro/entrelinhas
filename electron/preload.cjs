const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  pickFiles: () => ipcRenderer.invoke('files:pick'),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  readDocument: path => ipcRenderer.invoke('document:read', path),
  writeDocument: (path, content, expected) => ipcRenderer.invoke('document:write', path, content, expected),
  saveDocumentAs: (name, content) => ipcRenderer.invoke('document:save-as', name, content),
  restore: () => ipcRenderer.invoke('session:load'),
  save: state => ipcRenderer.invoke('session:save', state),
  flushAndClose: state => ipcRenderer.invoke('session:close', state),
  getPending: () => ipcRenderer.invoke('files:pending'),
  openExternal: url => ipcRenderer.invoke('external:open', url),
  onOpen: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('open-result', listener); return () => ipcRenderer.removeListener('open-result', listener); },
  onCommand: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('command', listener); return () => ipcRenderer.removeListener('command', listener); },
});
