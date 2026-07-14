/**
 * Control Room Studio navigation map.
 * Route ids stay stable (gallery, trends) for history/tests;
 * user-facing labels are Sessions and Progress.
 */

export const PRIMARY_NAV = [
  { id: "today", label: "Today", shortcut: "1" },
  { id: "record", label: "Record", shortcut: "2" },
  { id: "practice", label: "Practice", shortcut: "3" },
  { id: "gallery", label: "Sessions", shortcut: "4" },
  { id: "trends", label: "Progress", shortcut: "5" },
];

export const PAGE_LABELS = {
  today: "Today",
  record: "Record",
  practice: "Practice",
  gallery: "Sessions",
  session: "Session report",
  trends: "Progress",
  settings: "Settings",
};

/**
 * Global desktop shortcuts: Ctrl/Cmd + 1–5, comma.
 * @param {{ ctrlKey?: boolean, metaKey?: boolean, altKey?: boolean, key?: string, target?: EventTarget | null }} event
 * @returns {string | null}
 */
export function getGlobalShortcutRoute(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  ) {
    return null;
  }
  return (
    {
      1: "today",
      2: "record",
      3: "practice",
      4: "gallery",
      5: "trends",
      ",": "settings",
    }[event.key] || null
  );
}

export function getPageLabel(page) {
  return PAGE_LABELS[page] || "Praxis";
}
