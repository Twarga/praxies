import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Practice } from "./Practice.jsx";

vi.mock("../hooks/useToast.js", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock("../api/practice.js", () => ({
  getPracticeCurrent: vi.fn(async () => ({ active_goal: { text: "Lead with the conclusion" }, current_assignment: { assignment_id: "a1", title: "One-minute close", instructions: "State the decision and next action." } })),
  getPracticeHistory: vi.fn(async () => ({ assignments: [] })),
  completePracticeAssignment: vi.fn(async () => ({})),
}));

describe("Practice", () => {
  it("runs the focused timer and exposes all completion outcomes", async () => {
    const user = userEvent.setup();
    render(<Practice onNavigate={vi.fn()} scrollRef={{ current: null }} />);
    await waitFor(() => expect(screen.getAllByText("One-minute close").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: /start drill/i }));
    expect(screen.getAllByText("03:00").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /end drill/i }));
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Too hard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repeat later" })).toBeInTheDocument();
  });
});
