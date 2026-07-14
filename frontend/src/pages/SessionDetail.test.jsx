import { render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { SessionDetail } from "./SessionDetail.jsx";

const loadSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useConfig.js", () => ({ useConfig: () => ({ config: { llm: {}, openrouter: {} } }) }));
vi.mock("../hooks/useIndex.js", () => ({ useIndex: () => ({ refreshIndex: vi.fn(async () => {}) }) }));
vi.mock("../hooks/useToast.js", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock("../api/sessions.js", () => ({
  loadSession: loadSessionMock,
  getSessionVideoUrl: vi.fn(() => "video.webm"), getSessionExportedVideoUrl: vi.fn(), getSessionSubtitleUrl: vi.fn(),
  exportSessionSubtitledVideo: vi.fn(), exportSessionPrompt: vi.fn(), exportSessionTranscript: vi.fn(), markSessionRead: vi.fn(async () => ({})),
  reanalyzeSession: vi.fn(), retrySessionProcessing: vi.fn(), updateSessionPractice: vi.fn(),
}));

describe("SessionDetail", () => {
  beforeEach(() => {
    loadSessionMock.mockReset();
    loadSessionMock.mockResolvedValue({
      meta: { id: "session-1", title: "Minimum window review", created_at: "2026-07-12T12:00:00Z", duration_seconds: 3, status: "video_only", save_mode: "video_only", language: "en", read: true, video_filename: "video.webm", processing: {} },
      transcript: [], waveform: [], subtitles: [], subtitled_exports: [], analysis: null, analysis_raw_text: null,
    });
  });

  it("renders a video-only session without legacy provider state", async () => {
    render(<SessionDetail sessionId="session-1" onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    expect(await screen.findByText("Minimum window review")).toBeInTheDocument();
    expect(screen.getByText("video only")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to sessions" })).toBeInTheDocument();
  });

  it("announces the loading state while the session request is pending", () => {
    loadSessionMock.mockReturnValue(new Promise(() => {}));
    render(<SessionDetail sessionId="pending" onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    expect(screen.getByRole("status", { name: "Loading session" })).toBeInTheDocument();
  });

  it("renders a readable retry state when loading fails", async () => {
    loadSessionMock.mockRejectedValue(new Error("Session file could not be read."));
    render(<SessionDetail sessionId="broken" onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    expect(await screen.findByText("Session file could not be read.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps an offline provider failure readable and retryable", async () => {
    loadSessionMock.mockResolvedValue({
      meta: {
        id: "session-offline", title: "Offline review", created_at: "2026-07-12T12:00:00Z",
        duration_seconds: 180, status: "failed", save_mode: "full", language: "en", read: true,
        video_filename: "video.webm", error: "AI provider is offline. Check the connection and retry.",
        processing: { attempts: 2, terminal_lines: [{ created_at: "2026-07-12T12:03:00Z", level: "error", message: "Provider connection refused" }] },
      },
      transcript: [], waveform: [], subtitles: [], subtitled_exports: [], analysis: null, analysis_raw_text: null,
    });
    render(<SessionDetail sessionId="session-offline" onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    expect(await screen.findByText("AI provider is offline. Check the connection and retry.")).toBeInTheDocument();
    expect(screen.getByText("Provider connection refused")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("renders the ready report as a resizable 58/42 evidence workspace", async () => {
    window.localStorage.removeItem("praxis.session.split");
    loadSessionMock.mockResolvedValue({
      meta: { id: "session-1", title: "Ready review", created_at: "2026-07-12T12:00:00Z", duration_seconds: 180, status: "ready", save_mode: "full", language: "en", read: false, video_filename: "video.webm", processing: {} },
      transcript: [{ start_seconds: 0, end_seconds: 8, text: "I will state the conclusion first." }],
      waveform: [0.2, 0.8, 0.4], subtitles: [], subtitled_exports: [],
      analysis: {
        prose_verdict: "The conclusion was clear, but the middle repeated it.",
        coaching_report: { top_lessons: [{ title: "Reduce repetition", next_move: "Use one example." }], practice_assignment: { next_session_goal: "One example", speaking_drill: "Explain it once." }, what_improved: "The opening was direct." },
        speaking_quality: { clarity: 7, structure: 6, fluency: 8, confidence: 7 },
      },
      analysis_raw_text: null,
    });
    const { container } = render(<SessionDetail sessionId="session-1" onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    expect(await screen.findByText("Ready review")).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize report panes" })).toHaveClass("w-1.5");
    expect(container.querySelector("section")).toHaveStyle({ flex: "0 0 58%" });
    expect(container.querySelector("[data-section-order]")).toHaveAttribute("data-section-order", "verdict,what_worked,focus_next,evidence,detailed_feedback");
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelectorAll("[data-primary-cta='true']")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Run fresh analysis" })).toBeInTheDocument();
  });

  it("surfaces schema-v3 coaching in the primary report summary", async () => {
    loadSessionMock.mockResolvedValue({
      meta: { id: "session-v3", title: "V3 review", created_at: "2026-07-12T12:00:00Z", duration_seconds: 120, status: "ready", save_mode: "full", language: "en", read: true, video_filename: "video.webm", processing: {} },
      transcript: [{ start_seconds: 0, end_seconds: 5, text: "I need one decision." }], waveform: [], subtitles: [], subtitled_exports: [],
      analysis: {
        schema_version: 3,
        report: {
          verdict: "You found the issue but stopped before choosing an action.",
          strength: { title: "Plain language", explanation: "Your clearest sentence used a direct verb." },
          priority_improvement: { title: "End with one action", replacement_behavior: "Name one checkable action before stopping." },
          evidence_moments: [{ timestamp_seconds: 0, quote: "I need one decision.", explanation: "Names the need." }],
          practice: { title: "One-decision close", instructions: "State one decision." },
          next_goal: { text: "End with one verifiable action." },
        },
        details: { scorecard: { clarity: { score: 6 } } },
      },
      analysis_raw_text: null,
    });
    render(<SessionDetail sessionId="session-v3" onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    expect(await screen.findAllByText("You found the issue but stopped before choosing an action.")).not.toHaveLength(0);
    expect(screen.getAllByText("End with one action")).not.toHaveLength(0);
    expect(screen.getAllByText("Your clearest sentence used a direct verb.")).not.toHaveLength(0);
  });
});
