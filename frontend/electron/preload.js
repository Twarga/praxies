import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("twarga", {
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  quit: () => ipcRenderer.invoke("quit"),
});
