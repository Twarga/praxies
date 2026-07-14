import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "./ThemeContext.jsx";
import { useTheme } from "../hooks/useTheme.js";

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return <button type="button" onClick={() => setTheme("4")}>Theme {theme}</button>;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("applies and persists the selected theme", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    await user.click(screen.getByRole("button", { name: "Theme 0" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "4");
    expect(window.localStorage.getItem("praxis.theme")).toBe("4");
  });
});
