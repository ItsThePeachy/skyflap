const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('skyflapDesktop', {
  get: () => ipcRenderer.invoke('sd:get'),
  set: (o) => ipcRenderer.invoke('sd:set', o),
  onChange: (fn) => ipcRenderer.on('sd:changed', (_e, info) => fn(info)),
  update: {
    info: () => ipcRenderer.invoke('up:info'),
    check: (ch, force) => ipcRenderer.invoke('up:check', ch, force),
    restart: () => ipcRenderer.invoke('up:restart'),
    install: () => ipcRenderer.invoke('up:install'),
    on: (fn) => ipcRenderer.on('up:state', (_e, s) => fn(s))
  }
});
