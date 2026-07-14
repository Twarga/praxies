import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProcessingTimeline } from "./ProcessingTimeline.jsx";

describe("ProcessingTimeline", () => {
  it("renders pipeline stages, transform progress, and a toggleable local log", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProcessingTimeline
        steps={[{ id: "saved", kicker: "01", label: "Saved", done: true }, { id: "transcribing", kicker: "02", label: "Transcribing" }]}
        currentStep="transcribing"
        percent={45}
        logs={[{ created_at: "now", message: "Whisper started" }]}
      />,
    );

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Transcribing")).toBeInTheDocument();
    expect(container.querySelector(".praxis-progress-bar")).toHaveStyle({ transform: "scaleX(0.45)" });
    const details = screen.getByText("Processing log").closest("details");
    expect(details).not.toHaveAttribute("open");
    await user.click(screen.getByText("Processing log"));
    expect(details).toHaveAttribute("open");
    expect(screen.getByText("Whisper started")).toBeInTheDocument();
  });
});
