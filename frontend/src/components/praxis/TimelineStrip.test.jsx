import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimelineStrip } from "./TimelineStrip.jsx";

describe("TimelineStrip", () => {
  it("renders variable waveform bars and seeks through evidence markers", async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    const { container } = render(<TimelineStrip bars={[0.1, 0.5, 0.9]} markers={[{ timestamp_seconds: 25, kind: "filler", label: "Filler word" }]} duration={100} onSeek={onSeek} />);
    const bars = container.querySelectorAll('[aria-label="Seek recording timeline"] > span');
    expect(bars).toHaveLength(3);
    expect(bars[0].style.height).not.toBe(bars[2].style.height);
    await user.click(screen.getByRole("button", { name: "Filler word" }));
    expect(onSeek).toHaveBeenCalledWith(25);
  });

  it.each([["full", "h-8"], ["medium", "h-7"], ["tiny", "h-5"]])("supports the %s size", (size, className) => {
    const { container } = render(<TimelineStrip size={size} duration={10} />);
    expect(container.firstChild).toHaveClass(className);
  });
});
