import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { EvidenceMoment } from "./EvidenceMoment.jsx";

describe("EvidenceMoment", () => {
  it("announces active playback and seeks to its timestamp", async () => {
    const user = userEvent.setup(); const onSeek = vi.fn();
    render(<EvidenceMoment timestamp={65} quote="A specific example" explanation="This made the point clear." active onSeek={onSeek} />);
    const moment = screen.getByRole("button");
    expect(moment).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Playing")).toBeInTheDocument();
    expect(screen.getByText("01:05")).toBeInTheDocument();
    await user.click(moment); expect(onSeek).toHaveBeenCalledWith(65);
  });
});
