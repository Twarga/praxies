import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CurrentGoal } from "./CurrentGoal.jsx";

describe("CurrentGoal", () => {
  it("makes one practice action dominant and keeps recording available", async () => {
    const user = userEvent.setup();
    const onStartPractice = vi.fn();
    const onRecord = vi.fn();
    const { container } = render(
      <CurrentGoal
        goal={{ text: "State the conclusion first", status: "active", success_criteria: ["Conclusion within ten seconds"] }}
        assignment={{ title: "Direct opening", instructions: "Use the first sentence as evidence." }}
        onStartPractice={onStartPractice}
        onRecord={onRecord}
      />,
    );

    expect(screen.getByRole("heading", { name: "State the conclusion first" })).toHaveClass("text-xl", "font-semibold");
    expect(screen.getByText("Conclusion within ten seconds")).toBeInTheDocument();
    expect(container.querySelector("[data-goal-evidence='true']")).toHaveClass("border-l-2");
    expect(container.querySelectorAll("[data-primary-cta='true']")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /start practice/i }));
    await user.click(screen.getByRole("button", { name: /record journal/i }));
    expect(onStartPractice).toHaveBeenCalledOnce();
    expect(onRecord).toHaveBeenCalledOnce();
  });
});
