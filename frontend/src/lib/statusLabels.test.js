import { describe, expect, it } from "vitest";
import { getShellStatusLabel, getStatusLabel, STATUS_LABELS } from "./statusLabels.js";

describe("statusLabels (Control Room Studio)", () => {
  it("maps pipeline statuses to visible text labels", () => {
    expect(getStatusLabel("ready")).toBe("Ready");
    expect(getStatusLabel("recording")).toBe("Recording");
    expect(getStatusLabel("needs_attention")).toBe("Needs attention");
    expect(getStatusLabel("transcribing")).toBe("Transcribing");
    expect(getStatusLabel("analyzing")).toBe("Analyzing");
    expect(getStatusLabel(null)).toBe("Local");
  });

  it("never returns empty labels for known keys", () => {
    for (const [key, label] of Object.entries(STATUS_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
      expect(getStatusLabel(key)).toBe(label);
    }
  });

  it("maps shell status kinds used in title bar", () => {
    expect(getShellStatusLabel("idle")).toBe("Local");
    expect(getShellStatusLabel("active")).toBe("Processing");
    expect(getShellStatusLabel("attention")).toBe("Needs attention");
    expect(getShellStatusLabel("recording")).toBe("Recording");
  });
});
