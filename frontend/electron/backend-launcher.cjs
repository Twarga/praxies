const { spawn } = require("node:child_process");
const { join } = require("node:path");

const repoRoot = join(__dirname, "..", "..");
const backendRoot = join(repoRoot, "backend");
const defaultPython = join(repoRoot, ".venv", "bin", "python");
const pythonExecutable = process.env.PRAXIES_PYTHON || defaultPython;
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

  const child = spawn(
    pythonExecutable,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(defaultPort)],
    {
      cwd: backendRoot,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
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
