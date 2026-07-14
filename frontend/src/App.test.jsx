import { fireEvent, render, screen } from "@testing-library/react";
import App, { getGlobalShortcutRoute } from "./App.jsx";
import { getPageLabel, PRIMARY_NAV } from "./lib/nav.js";
import { vi } from "vitest";

vi.mock("./hooks/useConfig.js", () => ({ useConfig: () => ({ config: { setup_completed: true }, isLoading: false }) }));
vi.mock("./hooks/useIndex.js", () => ({ useIndex: () => ({ index: { sessions: [] } }) }));
vi.mock("./hooks/useEventSource.js", () => ({ useEventSource: () => ({ lastEvent: null, status: "connected" }) }));
vi.mock("./components/LiveUpdateEffects.jsx", () => ({ LiveUpdateEffects: () => null }));
vi.mock("./pages/Today.jsx", () => ({ Today: () => <div>Today workspace</div> }));
vi.mock("./pages/Record.jsx", () => ({ Record: () => <div>Record workspace</div> }));
vi.mock("./pages/Practice.jsx", () => ({ Practice: () => <div>Practice workspace</div> }));
vi.mock("./pages/Gallery.jsx", () => ({ Gallery: () => <div>Sessions workspace</div> }));
vi.mock("./pages/Trends.jsx", () => ({ Trends: () => <div>Progress workspace</div> }));
vi.mock("./pages/Settings.jsx", () => ({ Settings: () => <div>Settings workspace</div> }));
vi.mock("./pages/SessionDetail.jsx", () => ({ SessionDetail: () => <div>Session report</div> }));

describe("desktop navigation shortcuts", () => {
  it("maps Ctrl number keys and settings shortcut", () => {
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: "1", target: document.body })).toBe("today");
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: "2", target: document.body })).toBe("record");
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: "3", target: document.body })).toBe("practice");
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: "4", target: document.body })).toBe("gallery");
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: "5", target: document.body })).toBe("trends");
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: ",", target: document.body })).toBe("settings");
  });

  it("does not steal shortcuts while typing", () => {
    const input = document.createElement("input");
    expect(getGlobalShortcutRoute({ ctrlKey: true, metaKey: false, altKey: false, key: "2", target: input })).toBeNull();
    expect(getGlobalShortcutRoute({ ctrlKey: false, metaKey: false, altKey: false, key: "2", target: document.body })).toBeNull();
  });

  it("uses Sessions and Progress as primary labels", () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      "Today",
      "Record",
      "Practice",
      "Sessions",
      "Progress",
    ]);
    expect(getPageLabel("gallery")).toBe("Sessions");
    expect(getPageLabel("trends")).toBe("Progress");
  });

  it("keeps one desktop shell and removes the sidebar for Record", () => {
    const { container } = render(<App />);
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveAttribute("data-chrome", "full");
    fireEvent.click(screen.getByRole("button", { name: "Record" }));
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    expect(container.querySelector("main")).toHaveAttribute("data-chrome", "minimal");
    expect(screen.getByText("Record workspace")).toBeInTheDocument();
  });
});
