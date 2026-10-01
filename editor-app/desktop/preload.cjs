const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("skillEditor", {
  loadMetadata: () => ipcRenderer.invoke("editor:load-metadata"),
  getFilePath: (file) => webUtils.getPathForFile(file),
  previewImage: (data) => ipcRenderer.invoke("editor:preview-image", data),
  exportImage: (data) => ipcRenderer.invoke("editor:export-image", data),
  exportAllImages: (data) => ipcRenderer.invoke("editor:export-all-images", data),
  save: (payload) => ipcRenderer.invoke("editor:save", payload),
  saveClass: (payload) => ipcRenderer.invoke("editor:save-class", payload),
  saveCommonPassives: (items) => ipcRenderer.invoke("editor:save-common-passives", items),
  saveUpdateHistories: (histories) => ipcRenderer.invoke("editor:save-update-histories", histories),
  publish: () => ipcRenderer.invoke("editor:publish"),
});
