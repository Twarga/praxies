import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, "..", "..", "backend");
const pythonExecutable = process.env.PRAXIES_PYTHON || "python3";
const defaultPort = Number(process.env.PRAXIES_BACKEND_PORT || 8000);

export function launchBackend() {
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
  };
}
