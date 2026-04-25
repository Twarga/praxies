import { contextBridge, ipcRenderer } from "electron";

const desktopApi = {
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  quit: () => ipcRenderer.invoke("quit"),
};

contextBridge.exposeInMainWorld("praxis", desktopApi);
contextBridge.exposeInMainWorld("twarga", desktopApi);
