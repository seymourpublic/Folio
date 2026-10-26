const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  onOpenFile: (callback) => {
    ipcRenderer.on("open-file", (_event, payload) => callback(payload));
  },
  saveFile: (bytes, suggestedName, extension) =>
    ipcRenderer.invoke("save-file", { bytes, suggestedName, extension }),
  newWindow: () => ipcRenderer.invoke("new-window"),
  pickFolderToWatch: () => ipcRenderer.invoke("watch-folder:pick"),
  addWatchedFolder: (folderPath) => ipcRenderer.invoke("watch-folder:add", folderPath),
  removeWatchedFolder: (folderPath) => ipcRenderer.invoke("watch-folder:remove", folderPath),
  listWatchedFolders: () => ipcRenderer.invoke("watch-folder:list"),
  onWatchedFileAdded: (callback) => {
    ipcRenderer.on("watch-folder:file-added", (_event, payload) => callback(payload));
  },
  tsaRequest: (url, body) => ipcRenderer.invoke("tsa-request", { url, body }),
});
