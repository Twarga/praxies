export function setRouteScrollPosition(store, routeKey, position) {
  if (!routeKey) {
    return;
  }

  store.set(routeKey, Math.max(0, position));
}

export function getRouteScrollPosition(store, routeKey) {
  if (!routeKey) {
    return 0;
  }

  return store.get(routeKey) ?? 0;
}

export function getViewportScrollY(win = globalThis.window) {
  return win?.scrollY ?? 0;
}

export function restoreViewportScroll(position, win = globalThis.window) {
  win?.scrollTo?.(0, Math.max(0, position));
}
