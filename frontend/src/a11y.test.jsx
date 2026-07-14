import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname);
const app = fs.readFileSync(path.join(sourceRoot, "App.jsx"), "utf8");
const globals = fs.readFileSync(path.join(sourceRoot, "styles/globals.css"), "utf8");
const motion = fs.readFileSync(path.join(sourceRoot, "styles/motion.css"), "utf8");

describe("desktop accessibility contract", () => {
  it("provides a skip link and focusable main destination", () => {
    expect(app).toContain('href="#praxis-main"');
    expect(app).toContain('id="praxis-main"');
    expect(app).toContain("mainRef.current?.focus");
  });

  it("gives every native interactive element a shared focus-visible ring", () => {
    expect(globals).toMatch(/:where\(button, a, input, textarea, select, \[tabindex\]\):focus-visible/);
    expect(globals).toContain("var(--praxis-focus)");
  });

  it("fully disables authored motion when reduced motion is requested", () => {
    expect(motion).toContain("@media (prefers-reduced-motion: reduce)");
    expect(motion).toContain("animation-duration: 0s !important");
    expect(motion).toContain("transition-duration: 0s !important");
    expect(motion).toContain("scroll-behavior: auto !important");
  });
});
