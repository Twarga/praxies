import { describe, expect, it } from "vitest";
import { getRecordShortcutAction } from "./recordShortcuts.js";

function action(key, code, recorderState, permissionState = "granted", target = document.body) {
  return getRecordShortcutAction({ event: { key, code, target }, recorderState, permissionState });
}

describe("Record keyboard contract", () => {
  it("starts, pauses, resumes, stops, saves, and exits without stealing input", () => {
    expect(action(" ", "Space", "idle")).toBe("start");
    expect(action(" ", "Space", "recording")).toBe("pause");
    expect(action(" ", "Space", "paused")).toBe("resume");
    expect(action("s", "KeyS", "recording")).toBe("stop");
    expect(action("Enter", "Enter", "stopped")).toBe("save-full");
    expect(action("Escape", "Escape", "idle")).toBe("back");
    expect(action(" ", "Space", "idle", "granted", document.createElement("input"))).toBeNull();
  });
});
