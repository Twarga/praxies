export function chooseDirectory() {
  return window.twarga?.chooseDirectory?.() ?? Promise.resolve(null);
}

export function openDesktopPath(targetPath) {
  if (!targetPath) {
    return Promise.resolve(null);
  }

  return window.twarga?.openPath?.(targetPath) ?? Promise.resolve(null);
}
