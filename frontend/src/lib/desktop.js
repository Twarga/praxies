export function chooseDirectory() {
  return window.twarga?.chooseDirectory?.() ?? Promise.resolve(null);
}
