import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { SessionCheckin } from "./SessionCheckin.jsx";
import { saveDogfoodCheckin } from "../../api/dogfood.js";

vi.mock("../../api/dogfood.js", () => ({ saveDogfoodCheckin: vi.fn(async () => ({ saved: true })) }));

describe("SessionCheckin", () => {
  it("saves explicit answers and notes locally", async () => {
    const user = userEvent.setup();
    render(<SessionCheckin sessionId="session-42" />);
    await user.click(screen.getAllByRole("button", { name: "Yes" })[0]);
    await user.click(screen.getAllByRole("button", { name: "No" })[1]);
    await user.type(screen.getByPlaceholderText(/slow, confusing/i), "Model download was confusing");
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    await waitFor(() => expect(saveDogfoodCheckin).toHaveBeenCalledWith(expect.objectContaining({
      session_id: "session-42", understandable: true, correction_accurate: false,
      friction_notes: "Model download was confusing",
    })));
    expect(await screen.findByText(/Feedback saved locally/)).toBeInTheDocument();
  });
});
