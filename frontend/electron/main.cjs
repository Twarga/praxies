const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { appendFileSync, mkdirSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");
const { launchBackend } = require("./backend-launcher.cjs");

app.disableHardwareAcceleration();

const isDev = !app.isPackaged;
const electronLogFile = join(homedir(), ".cache", "praxis", "electron.log");
const appIconPath = isDev
  ? join(__dirname, "..", "public", "app-icon.png")
  : join(__dirname, "..", "dist", "app-icon.png");

let backendProcess;
const devFrontendUrl = process.env.PRAXIES_FRONTEND_URL || "http://127.0.0.1:5173";

function logElectron(message, error) {
  const suffix = error ? ` ${error.stack || error.message || String(error)}` : "";
  const line = `[${new Date().toISOString()}] ${message}${suffix}\n`;
  try {
    mkdirSync(join(homedir(), ".cache", "praxis"), { recursive: true });
    appendFileSync(electronLogFile, line);
  } catch {}
  console.log(line.trim());
}

process.on("uncaughtException", (error) => {
  logElectron("uncaught exception", error);
});

process.on("unhandledRejection", (error) => {
  logElectron("unhandled rejection", error);
});

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
  logElectron(`creating window; packaged=${app.isPackaged}`);
  const { child, port } = await launchBackend();
  backendProcess = child;

  if (child) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[backend] ${chunk}`);
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[backend] ${chunk}`);
    });

    child.on("error", (error) => {
      logElectron("backend process error", error);
    });

    child.on("exit", (code, signal) => {
      logElectron(`backend process exited code=${code ?? "null"} signal=${signal ?? "null"}`);
    });
  }

  try {
    await waitForBackend(port);
  } catch (error) {
    logElectron(`backend failed to start on port ${port}`, error);
    dialog.showErrorBox(
      "backend failed to start",
      "backend failed to start. See logs at ~/.cache/praxis/backend.log and ~/.cache/praxis/electron.log",
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
    icon: appIconPath,
    title: "Praxis",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await win.loadURL(devFrontendUrl);
  } else {
    await win.loadFile(join(__dirname, "..", "dist", "index.html"));
  }
  logElectron("main window loaded");
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
    logElectron("failed to create main window", error);
    dialog.showErrorBox("startup failed", "praxis failed to create the main window.");
    app.quit();
  });
});

app.on("window-all-closed", () => {
  logElectron("all windows closed");
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  logElectron("before quit");
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill("SIGTERM");
  }
});
