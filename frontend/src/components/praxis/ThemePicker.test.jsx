import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemePicker } from "./ThemePicker.jsx";

describe("ThemePicker", () => {
  it("renders six theme cards and changes the selected theme", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const themes = Array.from({ length: 6 }, (_, id) => ({ id: String(id), name: `Theme ${id}`, description: `Direction ${id}` }));
    render(<ThemePicker themes={themes} theme="0" onChange={onChange} />);
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: /Theme 0/ })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Theme 4/ }));
    expect(onChange).toHaveBeenCalledWith("4");
  });
});
