import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { Today } from "./Today.jsx";
import { IndexContext } from "../contexts/IndexContext.jsx";

vi.mock("../api/sessions.js", () => ({
  loadTodayDigest: vi.fn(async () => ({
    digest: {
      digest_date: "2026-05-08",
      session: {
        id: "session-1",
        created_at: "2026-05-08T09:00:00+00:00",
        title: "Morning review",
        duration_seconds: 180,
      },
      analysis: {
        prose_verdict: "Fallback verdict",
        coaching_report: {
          headline: "You were clearer once you gave one concrete example.",
          practice_assignment: {
            reflection_question: "What did I avoid saying directly?",
            speaking_drill: "Give one concrete example in under 20 seconds.",
            next_session_goal: "Close with one visible next action.",
          },
        },
      },
    },
  })),
  loadSession: vi.fn(async () => ({ meta: {}, analysis: null })),
}));

describe("Today", () => {
  it("renders the digest card with practice loop actions", async () => {
    render(
      <IndexContext.Provider
        value={{
          index: {
            generated_at: "2026-05-08T10:00:00+00:00",
            sessions: [
              {
                id: "session-1",
                created_at: "2026-05-08T09:00:00+00:00",
                language: "en",
                title: "Morning review",
                duration_seconds: 180,
                status: "ready",
                save_mode: "full",
                read: false,
              },
            ],
            totals: { sessions: 1, total_seconds: 180, by_language: { en: 1, fr: 0, es: 0 } },
            streak: { current: 1, longest: 1, last_active_date: "2026-05-08", last_reset_date: "2026-05-07" },
          },
          isLoading: false,
          error: null,
          refreshIndex: async () => {},
        }}
      >
        <Today onNavigate={() => {}} scrollRef={{ current: null }} />
      </IndexContext.Provider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/You were clearer once you gave one concrete example\./),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("What did I avoid saying directly?")).toBeInTheDocument();
    expect(screen.getByText("Give one concrete example in under 20 seconds.")).toBeInTheDocument();
    expect(screen.getByText("Close with one visible next action.")).toBeInTheDocument();
  });
});
