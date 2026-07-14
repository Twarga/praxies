import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionBrowser } from "./SessionBrowser.jsx";

vi.mock("../../api/sessions.js", () => ({ getSessionThumbnailUrl: (id) => `/thumb/${id}` }));

const sessions = [
  { id: "s1", title: "First session", created_at: "2026-07-14T10:00:00Z", duration_seconds: 180, status: "ready", language: "en" },
  { id: "s2", title: "Second session", created_at: "2026-07-13T10:00:00Z", duration_seconds: 240, status: "processing", language: "fr" },
];

function renderBrowser({ onNavigate = vi.fn() } = {}) {
  return {
    onNavigate,
    ...render(
      <SessionBrowser
        sessions={sessions}
        groups={[{ label: "July 2026", sessions }]}
        search=""
        onSearch={vi.fn()}
        langFilter="all"
        onLangFilter={vi.fn()}
        statusFilter="all"
        onStatusFilter={vi.fn()}
        dateRange="all"
        onDateRange={vi.fn()}
        sort="newest"
        onSort={vi.fn()}
        onClearFilters={vi.fn()}
        onNavigate={onNavigate}
        isLoading={false}
        hasArchiveSessions
      />,
    ),
  };
}

describe("SessionBrowser", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1280 });
  });

  it("uses a 300px master list, accent selection, and keyboard opening", () => {
    const onNavigate = vi.fn();
    renderBrowser({ onNavigate });
    const list = screen.getByRole("region", { name: "Session list" });
    expect(list).toHaveStyle({ flex: "0 0 300px" });
    expect(screen.getByRole("button", { name: /First session/ })).toHaveClass("border-l-[var(--praxis-accent)]");
    list.focus();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("session", { sessionId: "s2" });
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByPlaceholderText("Search past sessions...")).toHaveFocus();
  });

  it("collapses to a list with an inspector toggle below 1024px", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 900 });
    const user = userEvent.setup();
    renderBrowser();
    expect(screen.getByRole("region", { name: "Session list" })).toHaveStyle({ flex: "1 1 0%" });
    const preview = screen.getByRole("button", { name: "Preview" });
    expect(preview).toBeInTheDocument();
    const closePreview = screen.getByRole("button", { name: "Close preview" });
    expect(closePreview.closest("section")).toHaveClass("hidden");
    await user.click(preview);
    expect(closePreview.closest("section")).toHaveClass("block");
  });
});
