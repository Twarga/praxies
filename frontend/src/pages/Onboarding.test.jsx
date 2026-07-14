import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ONBOARDING_STEPS, Onboarding, getOnboardingRepairStep } from "./Onboarding.jsx";

vi.mock("../hooks/useConfig.js", () => ({ useConfig: () => ({ config: { journal_folder: "/tmp/PraxisJournal", language_default: "en", llm: {}, whisper: {} }, patchConfig: vi.fn(), isPatching: false }) }));
vi.mock("../hooks/useToast.js", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
const setTheme = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useTheme.js", () => ({ useTheme: () => ({ theme: "0", setTheme, themes: [
  { id: "0", name: "Control Room", description: "Dark graphite studio" },
  { id: "1", name: "Warm Editorial", description: "Paper and ink" },
  { id: "2", name: "Bauhaus", description: "Bold geometry" },
  { id: "3", name: "Zen Garden", description: "Quiet indigo" },
  { id: "4", name: "Brutalist Terminal", description: "Raw terminal" },
] }) }));
vi.mock("../api/providers.js", () => ({ createConnection: vi.fn(), getConnectionModels: vi.fn(), listProviders: vi.fn(async () => []), testConnectionModel: vi.fn(), updateConnection: vi.fn() }));
vi.mock("../components/praxis/TranscriptionSettingsPanel.jsx", () => ({ TranscriptionSettingsPanel: () => null }));

describe("onboarding contract", () => {
  it("keeps the eight-step first-run path with appearance selection", () => {
    expect(ONBOARDING_STEPS).toEqual([
      "Privacy", "Appearance", "Journal", "Objective", "Transcription",
      "AI provider", "Runtime check", "Baseline",
    ]);
  });

  it("routes failed checks back to the setting that can repair them", () => {
    expect(getOnboardingRepairStep("journal folder")).toBe(2);
    expect(getOnboardingRepairStep("active transcription model")).toBe(4);
    expect(getOnboardingRepairStep("active AI provider")).toBe(5);
  });

  it("renders one first-run task and advances through the sticky setup frame", async () => {
    const user = userEvent.setup();
    const { container } = render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Build a speaking practice you can actually repeat." })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 8")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Begin setup" }));
    expect(screen.getByRole("heading", { name: "Choose how Praxis should feel." })).toBeInTheDocument();
    expect(container.querySelectorAll("button[aria-pressed]")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Use Brutalist Terminal design" }));
    expect(setTheme).toHaveBeenCalledWith("4");
    expect(screen.getByText("Selected:").parentElement).toHaveTextContent("Brutalist Terminal");
  });

  it("keeps multiple selected coaching tracks in the onboarding draft", async () => {
    window.localStorage.setItem("praxis.onboarding.draft.v1", JSON.stringify({ step: 3, goals: ["journal", "language"] }));
    const { unmount } = render(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Journal Better/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Practice Language/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: /Speak Clearly/ }));
    expect(screen.getByRole("button", { name: /Speak Clearly/ })).toHaveAttribute("aria-pressed", "true");
    unmount();
    window.localStorage.removeItem("praxis.onboarding.draft.v1");
  });
});
