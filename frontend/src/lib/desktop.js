export function chooseDirectory() {
  return window.praxis?.chooseDirectory?.() ?? window.twarga?.chooseDirectory?.() ?? Promise.resolve(null);
}

export function openDesktopPath(targetPath) {
  if (!targetPath) {
    return Promise.resolve(null);
  }

  return window.praxis?.openPath?.(targetPath) ?? window.twarga?.openPath?.(targetPath) ?? Promise.resolve(null);
}

export function minimizeDesktopWindow() {
  return window.praxis?.minimizeWindow?.() ?? Promise.resolve(false);
}

export function toggleMaximizeDesktopWindow() {
  return window.praxis?.toggleMaximizeWindow?.() ?? Promise.resolve(false);
}

export function closeDesktopWindow() {
  return window.praxis?.closeWindow?.() ?? Promise.resolve(false);
}
