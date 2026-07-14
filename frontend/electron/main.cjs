const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { appendFileSync, mkdirSync, writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");
const { launchBackend } = require("./backend-launcher.cjs");

if (process.env.PRAXIS_DISABLE_HARDWARE_ACCELERATION === "1") {
  app.disableHardwareAcceleration();
}
if (process.env.PRAXIS_FAKE_MEDIA === "1") {
  app.commandLine.appendSwitch("use-fake-device-for-media-stream");
  app.commandLine.appendSwitch("use-fake-ui-for-media-stream");
}

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
    width: Number(process.env.PRAXIS_WINDOW_WIDTH || 1200),
    height: Number(process.env.PRAXIS_WINDOW_HEIGHT || 800),
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    icon: appIconPath,
    title: "Praxis",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    logElectron(`renderer console level=${level} ${message} (${sourceId}:${line})`);
  });
  win.webContents.on("did-fail-load", (_event, code, description, url) => {
    logElectron(`renderer load failed code=${code} url=${url} description=${description}`);
  });

  if (isDev) {
    await win.loadURL(devFrontendUrl);
  } else {
    const query = process.env.PRAXIS_CAPTURE_SESSION_ID ? { session: process.env.PRAXIS_CAPTURE_SESSION_ID } : undefined;
    await win.loadFile(join(__dirname, "..", "dist", "index.html"), query ? { query } : undefined);
  }
  await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const check = () => {
      const text = document.body?.innerText?.trim() || "";
      if (text.length >= 20) return resolve(text.slice(0, 200));
      if (Date.now() > deadline) return reject(new Error("Renderer did not display visible application content"));
      setTimeout(check, 100);
    };
    check();
  })`);
  logElectron("renderer content verified");
  logElectron("main window loaded");
  if (process.env.PRAXIS_CAPTURE_SCREENSHOT) {
    if (process.env.PRAXIS_CAPTURE_SHORTCUT) {
      const key = JSON.stringify(process.env.PRAXIS_CAPTURE_SHORTCUT);
      await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent("keydown", { key: ${key}, ctrlKey: true, bubbles: true }))`);
    }
    if (process.env.PRAXIS_CAPTURE_SCENARIO === "record-discard") {
      const recordingMs = Math.max(1000, Number(process.env.PRAXIS_PROFILE_RECORDING_MS || 6000));
      const scenarioState = await win.webContents.executeJavaScript(`(async () => {
        const waitFor = async (find, timeout = 20000) => {
          const deadline = Date.now() + timeout;
          while (Date.now() < deadline) {
            const result = find();
            if (result) return result;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          throw new Error("Timed out waiting for recording scenario UI");
        };
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "2", ctrlKey: true, bubbles: true }));
        const start = await waitFor(() => document.querySelector('button[aria-label="Start recording"]'));
        start.click();
        await waitFor(() => document.querySelector('button[aria-label="Stop"]'));
        await new Promise((resolve) => setTimeout(resolve, ${recordingMs}));
        document.querySelector('button[aria-label="Stop"]').click();
        await waitFor(() => [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Discard"), 30000);
        [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Discard").click();
        const confirmation = await waitFor(() => [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === "Confirm Discard"));
        confirmation.scrollIntoView({ block: "center" });
        return confirmation.textContent.trim();
      })()`);
      if (process.env.PRAXIS_PROFILE_OUTPUT) {
        const processMetrics = app.getAppMetrics().map((metric) => ({
          type: metric.type,
          pid: metric.pid,
          memory_kb: metric.memory,
          cpu: metric.cpu,
        }));
        const rendererMetrics = await win.webContents.executeJavaScript(`({
          js_heap_used_bytes: performance.memory?.usedJSHeapSize ?? null,
          js_heap_total_bytes: performance.memory?.totalJSHeapSize ?? null,
          recording_ms: ${recordingMs},
          state: ${JSON.stringify("discard-confirmation")},
          scenario_result: ${JSON.stringify(scenarioState)}
        })`);
        writeFileSync(process.env.PRAXIS_PROFILE_OUTPUT, `${JSON.stringify({ processes: processMetrics, renderer: rendererMetrics }, null, 2)}\n`);
      }
    }
    const captureDelayMs = Math.max(0, Number(process.env.PRAXIS_CAPTURE_DELAY_MS || 800));
    await new Promise((resolve) => setTimeout(resolve, captureDelayMs));
    const image = await win.webContents.capturePage();
    writeFileSync(process.env.PRAXIS_CAPTURE_SCREENSHOT, image.toPNG());
    logElectron(`screenshot captured: ${process.env.PRAXIS_CAPTURE_SCREENSHOT}`);
    app.quit();
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

  ipcMain.handle("window-minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
    return true;
  });

  ipcMain.handle("window-toggle-maximize", (event) => {
    const target = BrowserWindow.fromWebContents(event.sender);
    if (!target) return false;
    if (target.isMaximized()) target.unmaximize();
    else target.maximize();
    return true;
  });

  ipcMain.handle("window-close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
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
