import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderConnectionsPanel } from "./ProviderConnectionsPanel.jsx";

const api = vi.hoisted(() => ({
  createConnection: vi.fn(),
  deleteConnection: vi.fn(),
  getConnectionModels: vi.fn(),
  listConnections: vi.fn(),
  listProviders: vi.fn(),
  testConnectionModel: vi.fn(),
  updateConnection: vi.fn(),
}));

vi.mock("../../api/providers.js", () => api);

describe("ProviderConnectionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listProviders.mockResolvedValue([{ provider_id: "opencode_zen", display_name: "OpenCode Zen", auth_methods: [{ required: true }] }]);
    api.listConnections.mockResolvedValue([{ id: "zen-1", provider_id: "opencode_zen", display_name: "OpenCode Zen", selected_model_id: "", active: false }]);
    api.getConnectionModels.mockResolvedValue({ models: [{ id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6" }] });
    api.updateConnection.mockResolvedValue({});
    api.testConnectionModel.mockResolvedValue({ verified: true });
  });

  it("loads saved catalogs without credential discovery and activates only after testing", async () => {
    const user = userEvent.setup();
    render(<ProviderConnectionsPanel pushToast={vi.fn()} />);

    const modelSelect = await screen.findByRole("combobox", { name: "Choose model for OpenCode Zen" });
    expect(screen.queryByText(/connections found on this computer/i)).not.toBeInTheDocument();
    await user.selectOptions(modelSelect, "claude-sonnet-4-6");

    await waitFor(() => expect(api.updateConnection).toHaveBeenCalledTimes(1));
    expect(api.testConnectionModel).toHaveBeenCalledWith("zen-1", "claude-sonnet-4-6");
    expect(api.updateConnection).toHaveBeenCalledWith("zen-1", { active: true });
    expect(api.testConnectionModel.mock.invocationCallOrder[0]).toBeLessThan(api.updateConnection.mock.invocationCallOrder[0]);
  });
});
