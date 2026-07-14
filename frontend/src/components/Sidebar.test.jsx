import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar.jsx";

let index = { sessions: [] };
vi.mock("../hooks/useIndex.js", () => ({ useIndex: () => ({ index }) }));
vi.mock("../hooks/useEventSource.js", () => ({ useEventSource: () => ({ lastEvent: null, status: "connected" }) }));

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    index = { sessions: [] };
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
  });

  it("forces the 56px rail below 1024px", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 900 });
    const { container } = render(<Sidebar currentPage="today" onNavigate={vi.fn()} />);
    expect(container.querySelector("nav")).toHaveClass("sm:w-14");
    expect(screen.getByRole("button", { name: "Today" }).querySelector("span")).toHaveClass("sm:opacity-0");
    expect(screen.queryByRole("button", { name: "Expand sidebar" })).not.toBeInTheDocument();
  });

  it("persists its 56px collapsed and 220px expanded states", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar currentPage="today" onNavigate={vi.fn()} />);
    const nav = container.querySelector("nav");
    expect(nav).toHaveClass("sm:w-[220px]");
    expect(screen.getByText("Today").className).toContain("--praxis-spring-settle");
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(nav).toHaveClass("sm:w-14");
    await waitFor(() => expect(localStorage.getItem("praxis.sidebar.collapsed")).toBe("true"));
  });

  it("shows processing as a color plus text label without streak tiles", () => {
    index = { sessions: [{ id: "s-1", title: "Daily take", status: "transcribing" }] };
    const { container } = render(<Sidebar currentPage="today" onNavigate={vi.fn()} />);
    expect(screen.getByText("Transcribing")).toBeInTheDocument();
    expect(container.textContent).not.toContain("streak");
  });
});
