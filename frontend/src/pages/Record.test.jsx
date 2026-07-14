import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Record } from "./Record.jsx";

let recorder;
let index;
const refreshIndex = vi.fn(async () => index);
const finalizeSession = vi.fn(async () => ({ session_id: "session-1", status: "queued" }));

vi.mock("../hooks/useConfig.js", () => ({ useConfig: () => ({ config: { language_default: "en", video_quality: "720p" } }) }));
vi.mock("../hooks/useIndex.js", () => ({ useIndex: () => ({ index, refreshIndex }) }));
vi.mock("../hooks/useToast.js", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock("../hooks/useRecorder.js", () => ({ useRecorder: () => recorder }));
vi.mock("../api/practice.js", () => ({ getPracticeCurrent: vi.fn(async () => ({ active_goal: { text: "State the conclusion first", success_criteria: ["Conclusion in ten seconds"] } })) }));
vi.mock("../api/diagnostics.js", () => ({ getDiagnosticsChecks: vi.fn(async () => ({ checks: [] })) }));
vi.mock("../api/sessions.js", () => ({
  deleteSession: vi.fn(async () => ({})),
  finalizeSession: (...args) => finalizeSession(...args),
}));

function baseRecorder(overrides = {}) {
  return {
    elapsedSeconds: 0,
    error: null,
    pauseRecording: vi.fn(),
    recordedBlobUrl: null,
    resumeRecording: vi.fn(),
    sessionId: null,
    savedChunkCount: 0,
    startRecording: vi.fn(),
    state: "idle",
    stopRecording: vi.fn(),
    ...overrides,
  };
}

describe("Record studio workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    index = { sessions: [] };
    recorder = baseRecorder();
  });

  it("renders a ready 16:9 stage, goal, language, meter, and dominant start action", async () => {
    const { container } = render(<Record onNavigate={vi.fn()} />);
    expect(container.querySelector(".aspect-video")).toBeInTheDocument();
    expect(screen.getByText("EN_US")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start recording" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit recording" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("State the conclusion first")).toBeInTheDocument());
  });

  it("keeps camera and microphone choices in advanced controls", () => {
    render(<Record onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
    expect(screen.getByText("Camera")).toBeInTheDocument();
    expect(screen.getByText("Microphone")).toBeInTheDocument();
    expect(screen.getByText(/speech processing, echo cancellation/i)).toBeInTheDocument();
  });

  it("shows the complete processing chain and opens a ready report", async () => {
    index = { sessions: [{ id: "session-1", status: "ready" }] };
    recorder = baseRecorder({ state: "stopped", sessionId: "session-1", recordedBlobUrl: "/video.webm", elapsedSeconds: 12 });
    render(<Record onNavigate={vi.fn()} />);
    for (const label of ["Saved", "Transcribing", "Analyzing", "Ready"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Open report" })).toBeInTheDocument();
    await waitFor(() => expect(finalizeSession).toHaveBeenCalledWith("session-1", expect.objectContaining({ save_mode: "full" })));
  });

  it("makes the live timer, stop action, and level meter unmistakable", () => {
    recorder = baseRecorder({ state: "recording", sessionId: "session-live", elapsedSeconds: 83, savedChunkCount: 2 });
    render(<Record onNavigate={vi.fn()} />);
    expect(screen.getByText("01:23")).toHaveClass("tnum");
    expect(screen.getByRole("button", { name: /stop/i })).toHaveClass("bg-[var(--praxis-record)]");
    expect(screen.getByRole("meter", { name: "Microphone input level" })).toBeInTheDocument();
  });

  it("requires confirmation before discarding a stopped take", async () => {
    recorder = baseRecorder({ state: "stopped", sessionId: "session-1", recordedBlobUrl: "/video.webm", elapsedSeconds: 12 });
    render(<Record onNavigate={vi.fn()} />);
    const discard = screen.getByRole("button", { name: "Discard" });
    fireEvent.click(discard);
    expect(await screen.findByRole("button", { name: "Confirm Discard" })).toBeInTheDocument();
  });

  it("names a recording failure and offers Retry", () => {
    recorder = baseRecorder({ state: "error", error: new Error("device disconnected") });
    render(<Record onNavigate={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Recording failed");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
