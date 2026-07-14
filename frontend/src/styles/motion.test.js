import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../");
const motion = fs.readFileSync(path.join(root, "src/styles/motion.css"), "utf8");
const globals = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");
const tailwind = fs.readFileSync(path.join(root, "tailwind.config.js"), "utf8");

describe("Praxis motion system", () => {
  it("uses scoped transitions and true zero-duration reduced motion", () => {
    expect(motion).not.toMatch(/transition\s*:\s*all/);
    expect(motion).not.toContain("0.01ms");
    expect(motion).toContain("transition-duration: 0s !important");
    expect(motion).toContain("--praxis-transition-props");
  });

  it("defines the complete easing and overlay vocabulary", () => {
    for (const token of ["--praxis-ease-out", "--praxis-ease-in", "--praxis-ease-in-out", "--praxis-spring-settle"]) {
      expect(motion).toContain(token);
    }
    for (const keyframe of ["praxis-overlay-in", "praxis-overlay-out", "praxis-scale-in", "praxis-scale-out", "praxis-pop-in", "praxis-pop-out"]) {
      expect(motion).toContain(`@keyframes ${keyframe}`);
    }
    expect(motion).toMatch(/\.praxis-pane-exit\s*\{[\s\S]*var\(--praxis-ease-in\)/);
  });

  it("has one 160ms fade-in definition shared with Tailwind", () => {
    expect((motion.match(/@keyframes praxis-fade-in/g) || [])).toHaveLength(1);
    expect(globals).not.toContain("@keyframes praxis-fade-in");
    expect(tailwind).toContain('"fade-in 160ms cubic-bezier(0.23, 1, 0.32, 1)"');
  });
});
