import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { useRecorder } from "./useRecorder.js";
import { createSession, prepareSessionPreview, uploadSessionChunk } from "../api/sessions.js";

vi.mock("../api/sessions.js", () => ({
  createSession: vi.fn(async () => ({ session_id: "session-safe" })),
  getSessionVideoUrl: vi.fn(() => "http://127.0.0.1:8000/api/sessions/session-safe/video"),
  prepareSessionPreview: vi.fn(async () => ({ duration_seconds: 600 })),
  uploadSessionChunk: vi.fn(async () => ({ ok: true })),
}));

class FakeMediaRecorder {
  static instance;
  static isTypeSupported() { return true; }
  constructor() { this.state = "inactive"; this.mimeType = "video/webm"; FakeMediaRecorder.instance = this; }
  start(interval) { this.state = "recording"; this.interval = interval; }
  pause() { this.state = "paused"; }
  resume() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.onstop?.(); }
  emit(blob) { this.ondataavailable?.({ data: blob }); }
}

describe("useRecorder crash-safe chunks", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uploads five-second chunks while capture is still running", async () => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const stream = { getVideoTracks: () => [] };
    const { result, unmount } = renderHook(() => useRecorder({ language: "en", stream, videoQuality: "720p" }));
    await act(async () => { await result.current.startRecording(); });
    expect(createSession).toHaveBeenCalled();
    expect(FakeMediaRecorder.instance.interval).toBe(5000);
    act(() => FakeMediaRecorder.instance.emit(new Blob(["chunk-one"], { type: "video/webm" })));
    await waitFor(() => expect(uploadSessionChunk).toHaveBeenCalledWith("session-safe", 0, expect.any(Blob)));
    await waitFor(() => expect(result.current.savedChunkCount).toBe(1));
    expect(result.current.state).toBe("recording");
    unmount(); vi.unstubAllGlobals();
  });

  it("releases long recordings to backend storage instead of building one renderer blob", async () => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");
    const stream = { getVideoTracks: () => [] };
    const { result, unmount } = renderHook(() => useRecorder({ language: "en", stream, videoQuality: "720p" }));
    await act(async () => { await result.current.startRecording(); });
    for (let index = 0; index < 120; index += 1) {
      act(() => FakeMediaRecorder.instance.emit(new Blob([`chunk-${index}`], { type: "video/webm" })));
    }
    let stopped;
    await act(async () => { stopped = await result.current.stopRecording(); });
    expect(uploadSessionChunk).toHaveBeenCalledTimes(120);
    expect(prepareSessionPreview).toHaveBeenCalledWith("session-safe");
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(stopped.blob).toBeNull();
    expect(stopped.blobUrl).toContain("/session-safe/video");
    expect(result.current.state).toBe("stopped");
    unmount();
    createObjectUrl.mockRestore();
    vi.unstubAllGlobals();
  });
});
