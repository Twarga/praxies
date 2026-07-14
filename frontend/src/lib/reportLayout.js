/**
 * Control Room Studio — ready-report section order.
 * A single primary next-action CTA must appear before detailed feedback.
 */

export const REPORT_SECTION_ORDER = [
  "verdict",
  "what_worked",
  "focus_next",
  "evidence",
  "detailed_feedback",
];

/**
 * @param {{ hasPracticeCta?: boolean }} options
 * @returns {{ primaryCtaId: string, primaryCtaLabel: string, sectionOrder: string[] }}
 */
export function getReadyReportLayout(options = {}) {
  return {
    primaryCtaId: "practice-this-goal",
    primaryCtaLabel: "Practice this goal",
    sectionOrder: [...REPORT_SECTION_ORDER],
    showPrimaryCta: options.hasPracticeCta !== false,
  };
}

/**
 * Returns true when section A is ordered above section B in the report.
 * @param {string} above
 * @param {string} below
 */
export function isReportSectionAbove(above, below) {
  return REPORT_SECTION_ORDER.indexOf(above) < REPORT_SECTION_ORDER.indexOf(below);
}
