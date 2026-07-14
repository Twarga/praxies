import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Settings } from "./Settings.jsx";

const setTheme = vi.fn();
const patchConfig = vi.fn(async () => ({}));
const themes = Array.from({ length: 6 }, (_, id) => ({ id: String(id), name: `Theme ${id}`, description: `Direction ${id}` }));

vi.mock("../hooks/useConfig.js", () => ({
  useConfig: () => ({
    config: { language_default: "en", personal_context: "", ready_sound_enabled: true, video_quality: "720p", directness: "direct", phone_upload_enabled: true, phone_upload_url: "http://192.168.1.42:8765/upload", llm: {}, openrouter: {}, whisper: {} },
    patchConfig,
    isPatching: false,
  }),
}));
vi.mock("../hooks/useTheme.js", () => ({ useTheme: () => ({ theme: "0", setTheme, themes }) }));
vi.mock("../hooks/useToast.js", () => ({ useToast: () => ({ pushToast: vi.fn() }) }));
vi.mock("../api/config.js", () => ({ loadLlmProviders: vi.fn(async () => ({ providers: [] })), loadOpenRouterModels: vi.fn(async () => []), testLlm: vi.fn(), testWhisper: vi.fn() }));
vi.mock("../components/praxis/ProviderConnectionsPanel.jsx", () => ({ ProviderConnectionsPanel: () => null }));
vi.mock("../components/praxis/TranscriptionSettingsPanel.jsx", () => ({ TranscriptionSettingsPanel: () => null }));
vi.mock("../components/praxis/DogfoodSummary.jsx", () => ({ DogfoodSummary: () => null }));
vi.mock("../components/praxis/DiagnosticsPanel.jsx", () => ({ DiagnosticsPanel: () => null }));

describe("Settings", () => {
  it("shows searchable desktop sections, local save status, and six themes", async () => {
    const user = userEvent.setup();
    render(<Settings scrollRef={{ current: null }} />);
    expect(screen.getByText("Saved locally")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Theme \d/ })).toHaveLength(6);
    await user.click(screen.getByRole("button", { name: /Theme 4/ }));
    expect(setTheme).toHaveBeenCalledWith("4");
    await user.type(screen.getByRole("textbox", { name: "Search settings" }), "system");
    expect(screen.getByRole("tab", { name: "System Health" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "General" })).not.toBeInTheDocument();
  });

  it("shows the local-network phone upload control and address", async () => {
    const user = userEvent.setup();
    render(<Settings scrollRef={{ current: null }} />);
    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    expect(screen.getByText("Phone Upload")).toBeInTheDocument();
    expect(screen.getByText("http://192.168.1.42:8765/upload")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Allow phone upload" }));
    expect(patchConfig).toHaveBeenCalledWith({ phone_upload_enabled: false });
  });
});
