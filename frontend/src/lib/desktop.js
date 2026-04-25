export function chooseDirectory() {
  return window.praxis?.chooseDirectory?.() ?? window.twarga?.chooseDirectory?.() ?? Promise.resolve(null);
}

export function openDesktopPath(targetPath) {
  if (!targetPath) {
    return Promise.resolve(null);
  }

  return window.praxis?.openPath?.(targetPath) ?? window.twarga?.openPath?.(targetPath) ?? Promise.resolve(null);
}
