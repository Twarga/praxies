const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const electron = require("electron");
const app = typeof electron === "string" || !electron.app ? { isPackaged: false } : electron.app;

const isDev = !app.isPackaged;

function getBackendPaths() {
  if (isDev) {
    const repoRoot = join(__dirname, "..", "..");
    return {
      backendRoot: join(repoRoot, "backend"),
      pythonExecutable: process.env.PRAXIES_PYTHON || join(repoRoot, ".venv", "bin", "python"),
    };
  }

  const resourcesPath = process.resourcesPath;
  const bundledPython = join(resourcesPath, "python", "bin", "python");
  const hasBundledPython = existsSync(bundledPython);

  return {
    backendRoot: join(resourcesPath, "backend"),
    pythonExecutable: hasBundledPython
      ? bundledPython
      : (process.env.PRAXIES_PYTHON || "python3"),
  };
}

const defaultPort = Number(process.env.PRAXIES_BACKEND_PORT || 8000);
const skipBackendLaunch = process.env.PRAXIES_SKIP_BACKEND_LAUNCH === "1";

async function isBackendAlreadyRunning(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/config`);
    return response.ok;
  } catch {
    return false;
  }
}

async function launchBackend() {
  if (skipBackendLaunch) {
    return {
      child: null,
      port: defaultPort,
      reusedExisting: true,
    };
  }

  if (await isBackendAlreadyRunning(defaultPort)) {
    return {
      child: null,
      port: defaultPort,
      reusedExisting: true,
    };
  }

  const { backendRoot, pythonExecutable } = getBackendPaths();

  const child = spawn(
    pythonExecutable,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(defaultPort)],
    {
      cwd: backendRoot,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        PRAXIS_RESOURCES_PATH: isDev ? join(__dirname, "resources") : process.resourcesPath,
      },
      stdio: "pipe",
    },
  );

  return {
    child,
    port: defaultPort,
    reusedExisting: false,
  };
}

module.exports = {
  launchBackend,
};
