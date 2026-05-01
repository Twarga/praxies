import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { contextBridge, ipcRenderer } = require("electron");

const desktopApi = {
  chooseDirectory: () => ipcRenderer.invoke("choose-directory"),
  openPath: (targetPath) => ipcRenderer.invoke("open-path", targetPath),
  quit: () => ipcRenderer.invoke("quit"),
};

contextBridge.exposeInMainWorld("praxis", desktopApi);
contextBridge.exposeInMainWorld("twarga", desktopApi);
