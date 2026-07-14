import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadinessCard } from "./ReadinessCard.jsx";

describe("ReadinessCard", () => {
  it("shows streak, last session, weekly count, and next assignment", () => {
    render(<ReadinessCard streak={4} weeklyCount={3} lastSession={{ created_at: "2026-07-13T10:00:00Z" }} nextAssignment={{ title: "Lead with the conclusion" }} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("day streak")).toBeInTheDocument();
    expect(screen.getByText("3 sessions")).toBeInTheDocument();
    expect(screen.getByText("Lead with the conclusion")).toBeInTheDocument();
  });
});
