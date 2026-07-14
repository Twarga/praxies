import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { DiagnosticsPanel } from "./DiagnosticsPanel.jsx";
import { repairIndex, retestDiagnostics } from "../../api/diagnostics.js";

vi.mock("../../api/diagnostics.js", () => ({
  retestDiagnostics: vi.fn(async () => ({ checks: [{ name: "journal folder", ok: true, summary: "Journal ready.", detail: "", action: "" }] })),
  repairIndex: vi.fn(async () => ({ ok: true, message: "Index rebuilt with 3 sessions." })),
  getSupportBundle: vi.fn(async () => ({ redacted: true })),
  resetOnboarding: vi.fn(async () => ({ ok: true })),
}));

describe("DiagnosticsPanel", () => {
  it("shows runtime results and can repair the journal index", async () => {
    const user = userEvent.setup(); const pushToast = vi.fn();
    render(<DiagnosticsPanel pushToast={pushToast} />);
    expect(await screen.findByText("Journal ready.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Rebuild journal index/i }));
    await waitFor(() => expect(repairIndex).toHaveBeenCalled());
    expect(pushToast).toHaveBeenCalledWith({ kind: "success", message: "Index rebuilt with 3 sessions." });
    expect(retestDiagnostics).toHaveBeenCalledTimes(2);
  });
});
