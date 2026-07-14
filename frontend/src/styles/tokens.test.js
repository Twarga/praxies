import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname, "..");
const themeRoot = path.join(import.meta.dirname, "themes");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function parseHexVariables(css) {
  return Object.fromEntries(
    [...css.matchAll(/(--praxis-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((match) => [match[1], match[2]]),
  );
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("Praxis theme tokens", () => {
  it("ships and imports all six named themes", () => {
    const themes = fs.readdirSync(themeRoot).filter((file) => /^\d-.*\.css$/.test(file));
    const main = fs.readFileSync(path.join(sourceRoot, "main.jsx"), "utf8");

    expect(themes).toHaveLength(6);
    for (const theme of themes) {
      expect(main).toContain(`./styles/themes/${theme}`);
    }
  });

  it("keeps literal colors out of JavaScript and JSX", () => {
    const applicationFiles = walk(sourceRoot).filter((file) => /\.(js|jsx)$/.test(file) && !file.endsWith("tokens.test.js"));
    const violations = applicationFiles.flatMap((file) => {
      const matches = fs.readFileSync(file, "utf8").match(/#[0-9a-f]{3,8}\b/gi) || [];
      return matches.map((value) => `${path.relative(sourceRoot, file)}: ${value}`);
    });

    expect(violations).toEqual([]);
  });

  it("defines the required semantic contract in every theme", () => {
    const required = [
      "--praxis-bg-app",
      "--praxis-bg-canvas",
      "--praxis-bg-panel",
      "--praxis-text-primary",
      "--praxis-text-secondary",
      "--praxis-text-muted",
      "--praxis-accent",
      "--praxis-success",
      "--praxis-warning",
      "--praxis-danger",
      "--praxis-focus",
      "--praxis-on-accent",
      "--praxis-on-record",
      "--praxis-on-warning",
      "--praxis-on-success",
    ];

    for (const filename of fs.readdirSync(themeRoot).filter((file) => file.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(themeRoot, filename), "utf8");
      for (const token of required) expect(css, `${filename} is missing ${token}`).toContain(token);
    }
  });

  it("resolves every theme contract on the document root", () => {
    for (const filename of fs.readdirSync(themeRoot).filter((file) => file.endsWith(".css"))) {
      const css = fs.readFileSync(path.join(themeRoot, filename), "utf8");
      const themeId = filename.slice(0, 1);
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
      document.documentElement.dataset.theme = themeId;
      expect(getComputedStyle(document.documentElement).getPropertyValue("--praxis-bg-app").trim()).not.toBe("");
      style.remove();
    }
  });

  it("keeps body and compact-label text at AA contrast in every theme", () => {
    const textTokens = ["--praxis-text-primary", "--praxis-text-secondary", "--praxis-text-muted"];
    const surfaces = ["--praxis-bg-app", "--praxis-bg-canvas", "--praxis-bg-panel", "--praxis-bg-panel-raised"];

    for (const filename of fs.readdirSync(themeRoot).filter((file) => file.endsWith(".css"))) {
      const values = parseHexVariables(fs.readFileSync(path.join(themeRoot, filename), "utf8"));
      for (const textToken of textTokens) {
        for (const surface of surfaces) {
          expect(contrast(values[textToken], values[surface]), `${filename}: ${textToken} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      for (const [foreground, background] of [
        ["--praxis-on-accent", "--praxis-accent"],
        ["--praxis-on-record", "--praxis-record"],
        ["--praxis-on-warning", "--praxis-warning"],
        ["--praxis-on-success", "--praxis-success"],
      ]) {
        expect(contrast(values[foreground], values[background]), `${filename}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
