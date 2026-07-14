const { contextBridge, ipcRenderer } = require("electron");

const desktopApi = {
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window-toggle-maximize"),
  closeWindow: () => ipcRenderer.invoke("window-close"),
  quit: () => ipcRenderer.invoke("quit"),
};

contextBridge.exposeInMainWorld("praxis", desktopApi);
contextBridge.exposeInMainWorld("twarga", desktopApi);
