import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoachingVerdict } from "./CoachingVerdict.jsx";

describe("CoachingVerdict", () => {
  it("leads with a short verdict before supporting coaching sections", () => {
    const { container } = render(
      <CoachingVerdict
        verdict="Your conclusion was clear. The middle repeated the same point. Use one example before the final action."
        strength={{ title: "Direct opening", explanation: "The decision appeared immediately." }}
        improvement={{ title: "Reduce repetition", explanation: "The same claim appeared three times." }}
      />,
    );

    expect(screen.getByText(/Your conclusion was clear/)).toHaveClass("text-base");
    expect(container.textContent.indexOf("Your conclusion was clear")).toBeLessThan(container.textContent.indexOf("Direct opening"));
  });
});
