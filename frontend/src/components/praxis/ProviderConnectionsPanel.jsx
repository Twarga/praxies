import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  createConnection,
  deleteConnection,
  getConnectionModels,
  listConnections,
  listProviders,
  testConnectionModel,
  updateConnection,
} from "../../api/providers.js";

export function ProviderConnectionsPanel({ pushToast }) {
  const [providers, setProviders] = useState([]);
  const [connections, setConnections] = useState([]);
  const [providerId, setProviderId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelsByConnection, setModelsByConnection] = useState({});
  const [busy, setBusy] = useState("");

  async function refresh() {
    const [providerItems, connectionItems] = await Promise.all([listProviders(), listConnections()]);
    setProviders(Array.isArray(providerItems) ? providerItems : []);
    setConnections(Array.isArray(connectionItems) ? connectionItems : []);
    const catalogs = await Promise.all((connectionItems || []).map(async (connection) => {
      try {
        const catalog = await getConnectionModels(connection.id);
        return [connection.id, catalog.models || []];
      } catch {
        return [connection.id, []];
      }
    }));
    setModelsByConnection(Object.fromEntries(catalogs));
    if (!providerId && providerItems?.[0]?.provider_id) setProviderId(providerItems[0].provider_id);
  }

  useEffect(() => { void refresh().catch(() => {}); }, []);

  async function addConnection() {
    setBusy("add");
    try {
      const connection = await createConnection({ provider_id: providerId, api_key: apiKey.trim(), base_url: baseUrl.trim() });
      const catalog = await getConnectionModels(connection.id);
      setModelsByConnection((current) => ({ ...current, [connection.id]: catalog.models || [] }));
      setApiKey("");
      await refresh();
      pushToast({ kind: "success", message: "Provider connected. Choose a live catalog model." });
    } catch (error) {
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "Connection failed." });
    } finally { setBusy(""); }
  }

  async function loadModels(connectionId) {
    setBusy(connectionId);
    try {
      const catalog = await getConnectionModels(connectionId);
      setModelsByConnection((current) => ({ ...current, [connectionId]: catalog.models || [] }));
    } catch (error) {
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "Catalog unavailable." });
    } finally { setBusy(""); }
  }

  async function chooseModel(connectionId, modelId) {
    try {
      await testConnectionModel(connectionId, modelId);
      await updateConnection(connectionId, { active: true });
      await refresh();
      pushToast({ kind: "success", message: "Model verified and activated." });
    } catch (error) {
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "Model test failed." });
    }
  }

  const selectedProvider = providers.find((item) => item.provider_id === providerId);
  const needsKey = (selectedProvider?.auth_methods || []).some((method) => method.required);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-[var(--praxis-text-primary)]">AI providers</h3>
        <p className="mt-1 text-xs text-[var(--praxis-text-secondary)]">Connect an account, then choose from the models returned by that account.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-[var(--praxis-line-subtle)] pb-6">
        <label className="min-w-[190px] text-xs text-[var(--praxis-text-secondary)]">Provider
          <select value={providerId} onChange={(event) => setProviderId(event.target.value)} className="mt-2 block h-9 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 text-[var(--praxis-text-primary)]">
            {providers.map((item) => <option key={item.provider_id} value={item.provider_id}>{item.display_name}</option>)}
          </select>
        </label>
        {selectedProvider?.requires_base_url ? <label className="min-w-[230px] text-xs text-[var(--praxis-text-secondary)]">Base URL<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="mt-2 block h-9 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 text-[var(--praxis-text-primary)]" /></label> : null}
        {needsKey ? <label className="min-w-[230px] text-xs text-[var(--praxis-text-secondary)]">Credential<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="mt-2 block h-9 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 text-[var(--praxis-text-primary)]" /></label> : null}
        <button type="button" onClick={() => void addConnection()} disabled={!providerId || busy === "add" || (needsKey && !apiKey.trim())} className="inline-flex h-9 items-center gap-2 rounded bg-[var(--praxis-accent)] px-4 text-xs font-semibold text-[var(--praxis-on-accent)] disabled:opacity-40">{busy === "add" ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Connect</button>
      </div>
      <div className="divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">
        {connections.map((connection) => {
          const models = modelsByConnection[connection.id] || [];
          return <div key={connection.id} className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div><div className="flex items-center gap-2 text-sm font-medium text-[var(--praxis-text-primary)]">{connection.display_name}{connection.active ? <span className="rounded-full bg-[var(--praxis-success-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--praxis-success)]">Active</span> : null}</div><div className="mt-1 text-xs text-[var(--praxis-text-muted)]">{connection.provider_id}{connection.selected_model_id ? ` · ${connection.selected_model_id}` : " · choose a model to finish setup"}</div></div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void loadModels(connection.id)} className="rounded p-2 text-[var(--praxis-text-secondary)] hover:bg-[var(--praxis-hover)]" aria-label="Refresh models">{busy === connection.id ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
                <button type="button" onClick={() => void deleteConnection(connection.id).then(refresh)} className="rounded p-2 text-[var(--praxis-record)] hover:bg-[var(--praxis-hover)]" aria-label="Delete connection"><Trash2 size={15} /></button>
              </div>
            </div>
            {models.length ? <select aria-label={`Choose model for ${connection.display_name}`} value={connection.selected_model_id || ""} onChange={(event) => void chooseModel(connection.id, event.target.value)} className="mt-3 h-9 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 text-xs text-[var(--praxis-text-primary)]"><option value="" disabled>Choose an available model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.display_name || model.id}</option>)}</select> : null}
          </div>;
        })}
        {!connections.length ? <div className="py-8 text-center text-sm text-[var(--praxis-text-muted)]">No provider connections yet.</div> : null}
      </div>
    </div>
  );
}
