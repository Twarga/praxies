import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBackend } from "./backend-launcher.js";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let backendProcess;
const devFrontendUrl = process.env.PRAXIES_FRONTEND_URL || "http://127.0.0.1:5173";

async function waitForBackend(port, timeoutMs = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/config`);
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error("Backend failed to start in time.");
}

async function createWindow() {
  const { child, port } = await launchBackend();
  backendProcess = child;

  if (child) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[backend] ${chunk}`);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[backend] ${chunk}`);
    });
  }

  try {
    await waitForBackend(port);
  } catch (error) {
    await dialog.showErrorBox(
      "backend failed to start",
      "backend failed to start — see logs at ~/.cache/praxis/backend.log",
    );
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    title: "Praxis",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL(devFrontendUrl);
  } else {
    await win.loadFile(join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  ipcMain.handle("choose-directory", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (result.canceled) {
      return null;
    }
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle("open-path", async (_event, targetPath) => {
    if (!targetPath) {
      return false;
    }
    await shell.openPath(targetPath);
    return true;
  });

  ipcMain.handle("quit", async () => {
    app.quit();
    return true;
  });

  void createWindow().catch((error) => {
    console.error("[electron] failed to create main window:", error);
    dialog.showErrorBox("startup failed", "praxis failed to create the main window.");
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGTERM");
  }
});
