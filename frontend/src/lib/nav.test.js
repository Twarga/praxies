import { describe, expect, it } from "vitest";
import { getGlobalShortcutRoute, getPageLabel, PAGE_LABELS, PRIMARY_NAV } from "./nav.js";

describe("nav (Control Room Studio)", () => {
  it("exposes Sessions and Progress as primary user-facing labels", () => {
    expect(PRIMARY_NAV.find((item) => item.id === "gallery")?.label).toBe("Sessions");
    expect(PRIMARY_NAV.find((item) => item.id === "trends")?.label).toBe("Progress");
    expect(PAGE_LABELS.gallery).toBe("Sessions");
    expect(PAGE_LABELS.trends).toBe("Progress");
    expect(getPageLabel("gallery")).toBe("Sessions");
    expect(getPageLabel("trends")).toBe("Progress");
  });

  it("maps Ctrl/Cmd 1–5 and comma to routes", () => {
    const base = { ctrlKey: true, metaKey: false, altKey: false, target: document.body };
    expect(getGlobalShortcutRoute({ ...base, key: "1" })).toBe("today");
    expect(getGlobalShortcutRoute({ ...base, key: "2" })).toBe("record");
    expect(getGlobalShortcutRoute({ ...base, key: "3" })).toBe("practice");
    expect(getGlobalShortcutRoute({ ...base, key: "4" })).toBe("gallery");
    expect(getGlobalShortcutRoute({ ...base, key: "5" })).toBe("trends");
    expect(getGlobalShortcutRoute({ ...base, key: "," })).toBe("settings");
  });

  it("does not steal shortcuts while typing", () => {
    const input = document.createElement("input");
    expect(
      getGlobalShortcutRoute({
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        key: "2",
        target: input,
      }),
    ).toBeNull();
  });
});
