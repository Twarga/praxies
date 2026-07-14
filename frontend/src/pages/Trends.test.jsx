import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Trends } from "./Trends.jsx";

vi.mock("../api/trends.js", () => ({
  loadTrends: vi.fn(async () => ({
    volume_summary: { sessions: 2, hours: 0.2, active_days: 2, by_language: { en: 2 } },
    analysis_summary: { sessions: 2 },
    fluency_by_language: { en: [{ session_id: "s1", date: "2026-07-12", score: 6 }, { session_id: "s2", date: "2026-07-13", score: 7 }] },
    scorecard_dimensions: [], pattern_hits_by_language: {}, filler_words_by_language: {},
  })),
  loadPatterns: vi.fn(async () => ({ patterns: [] })),
  calibratePattern: vi.fn(async () => ({})),
}));

describe("Progress", () => {
  it("is text-first, presents one primary chart, periods, and linked sessions", async () => {
    render(<Trends onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    await waitFor(() => expect(screen.getByText("What the evidence says")).toBeInTheDocument());
    expect(screen.getByText(/Record 3\+ sessions/)).toBeInTheDocument();
    for (const label of ["7D", "30D", "90D", "ALL"]) expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fluency score line chart" })).toBeInTheDocument();
    expect(screen.getByText("Sessions in this trend")).toBeInTheDocument();
  });
});
