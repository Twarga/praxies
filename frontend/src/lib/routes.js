export function createPageRoute(name) {
  return { name, params: {} };
}

export function createSessionRoute(sessionId) {
  return { name: "session", params: { sessionId } };
}

export function getRouteKey(route) {
  if (!route || route.name !== "session") {
    return route?.name ?? "today";
  }

  return `session/${route.params?.sessionId ?? ""}`;
}

export function getActiveNavKey(route) {
  if (!route) {
    return "today";
  }

  if (route.name === "session") {
    return "gallery";
  }

  return route.name;
}

export function isRecordRoute(route) {
  return route?.name === "record";
}
