const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("skillEditor", {
  save: (payload) => ipcRenderer.invoke("editor:save", payload),
  publish: () => ipcRenderer.invoke("editor:publish"),
});
