import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PraxisLogo } from "./PraxisLogo.jsx";

describe("PraxisLogo", () => {
  it("uses stable geometry with theme-token colors", () => {
    const { container } = render(<PraxisLogo title="Praxis" size={32} />);
    const logo = screen.getByRole("img", { name: "Praxis" });
    expect(logo).toHaveAttribute("viewBox", "0 0 100 100");
    expect(logo).toHaveAttribute("width", "32");
    expect(container.querySelector("path")).toHaveAttribute("stroke", "var(--praxis-logo-mark, var(--praxis-text-primary))");
    expect(container.querySelector("circle")).toHaveAttribute("fill", "var(--praxis-logo-accent, var(--praxis-accent))");
  });

  it("is decorative by default", () => {
    const { container } = render(<PraxisLogo />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
