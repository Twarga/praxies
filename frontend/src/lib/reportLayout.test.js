import { describe, expect, it } from "vitest";
import {
  getReadyReportLayout,
  isReportSectionAbove,
  REPORT_SECTION_ORDER,
} from "./reportLayout.js";

describe("reportLayout (Control Room Studio)", () => {
  it("places focus_next (primary CTA section) above detailed feedback and evidence", () => {
    expect(isReportSectionAbove("focus_next", "detailed_feedback")).toBe(true);
    expect(isReportSectionAbove("focus_next", "evidence")).toBe(true);
    expect(isReportSectionAbove("verdict", "focus_next")).toBe(true);
  });

  it("exposes a single primary next-action CTA label", () => {
    const layout = getReadyReportLayout();
    expect(layout.primaryCtaId).toBe("practice-this-goal");
    expect(layout.primaryCtaLabel).toBe("Practice this goal");
    expect(layout.showPrimaryCta).toBe(true);
    expect(REPORT_SECTION_ORDER).toContain("focus_next");
    expect(REPORT_SECTION_ORDER.indexOf("focus_next")).toBeLessThan(
      REPORT_SECTION_ORDER.indexOf("detailed_feedback"),
    );
  });
});
