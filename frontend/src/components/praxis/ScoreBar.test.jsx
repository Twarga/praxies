import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreBar } from "./ScoreBar.jsx";

describe("ScoreBar", () => {
  it("renders a label and fills by scaleX without a width style", () => {
    const { container } = render(<ScoreBar label="Clarity" value={7.5} />);
    expect(screen.getByText("Clarity")).toBeInTheDocument();
    const fill = container.querySelector('[role="meter"] > div');
    expect(fill.style.transform).toBe("scaleX(0.75)");
    expect(fill.style.width).toBe("");
  });

  it("clamps normalized endpoints", () => {
    const { container, rerender } = render(<ScoreBar label="Structure" value={0} />);
    expect(container.querySelector('[role="meter"] > div').style.transform).toBe("scaleX(0)");
    rerender(<ScoreBar label="Structure" value={10} />);
    expect(container.querySelector('[role="meter"] > div').style.transform).toBe("scaleX(1)");
  });
});
