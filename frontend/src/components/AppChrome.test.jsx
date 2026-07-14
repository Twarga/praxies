import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppChrome } from "./AppChrome.jsx";

vi.mock("../hooks/useIndex.js", () => ({ useIndex: () => ({ index: { sessions: [] } }) }));
vi.mock("../hooks/useEventSource.js", () => ({ useEventSource: () => ({ lastEvent: null, status: "connected" }) }));

describe("AppChrome", () => {
  beforeEach(() => {
    window.praxis = {
      minimizeWindow: vi.fn().mockResolvedValue(true),
      toggleMaximizeWindow: vi.fn().mockResolvedValue(true),
      closeWindow: vi.fn().mockResolvedValue(true),
    };
  });

  it("renders draggable desktop chrome with labeled status and native controls", async () => {
    const user = userEvent.setup();
    const { container } = render(<AppChrome currentPage="today" onNavigate={vi.fn()} />);
    expect(container.querySelector("header")).toHaveClass("praxis-titlebar");
    expect(container.querySelector("header svg path[stroke*='praxis-logo-mark']")).toBeInTheDocument();
    expect(container.querySelector("header img[src*='app-icon']")).not.toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByLabelText("Window controls")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Minimize window" }));
    expect(window.praxis.minimizeWindow).toHaveBeenCalledOnce();
  });

  it("labels the reduced Record chrome", () => {
    render(<AppChrome currentPage="record" isRecordingRoute onNavigate={vi.fn()} />);
    expect(screen.getAllByText("Recording").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /exit/i })).toBeInTheDocument();
  });
});
