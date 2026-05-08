import { fireEvent, render, screen } from "@testing-library/react";
import { StreakGrid } from "./StreakGrid.jsx";

describe("StreakGrid", () => {
  it("shows active-day count and hover summary for qualifying sessions", () => {
    render(
      <StreakGrid
        endDate={new Date("2026-05-08T12:00:00")}
        sessions={[
          { created_at: "2026-05-07T09:00:00", duration_seconds: 180 },
          { created_at: "2026-05-06T09:00:00", duration_seconds: 3600 },
          { created_at: "2026-05-05T09:00:00", duration_seconds: 60 },
        ]}
      />,
    );

    expect(screen.getByText("2 active days")).toBeInTheDocument();
    expect(screen.getByText("Hover a day to inspect practice activity.")).toBeInTheDocument();

    const day = screen.getByRole("button", {
      name: "2026-05-07 · 1 session · 3 min",
    });
    fireEvent.mouseEnter(day);

    expect(screen.getByText("2026-05-07 · 1 session · 3 min")).toBeInTheDocument();
  });
});
