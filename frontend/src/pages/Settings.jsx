import { Check, FolderOpen, Loader2, RefreshCw, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import {
  loadLlmProviders,
  loadOpenRouterModels,
  testLlm,
  testWhisper,
} from "../api/config.js";
import { useConfig } from "../hooks/useConfig.js";
import { useToast } from "../hooks/useToast.js";
import { chooseDirectory, openDesktopPath } from "../lib/desktop.js";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English (US)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
];

const VIDEO_QUALITY_OPTIONS = [
  { value: "480p", label: "480p · Low storage" },
  { value: "720p", label: "720p · Recommended" },
  { value: "1080p", label: "1080p · High detail" },
];

const RETENTION_OPTIONS = [7, 14, 30, 60, 90];

const WHISPER_MODELS = [
  "tiny",
  "base",
  "small",
  "medium",
  "large-v3",
  "large-v3-turbo",
];

const DIRECTNESS_OPTIONS = [
  { value: "gentle", label: "Gentle" },
  { value: "direct", label: "Direct" },
  { value: "brutal", label: "Brutal" },
];

const OPENCODE_GO_MODELS = [
  "glm-5.1",
  "glm-5",
  "kimi-k2.6",
  "kimi-k2.5",
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "mimo-v2.5",
  "mimo-v2.5-pro",
  "qwen3.6-plus",
  "qwen3.5-plus",
];

const TABS = [
  { id: "general", label: "General" },
  { id: "recording", label: "Recording" },
  { id: "ai", label: "AI & Processing" },
  { id: "storage", label: "Storage" },
  { id: "advanced", label: "Advanced" },
];

function Card({ children, className = "" }) {
  return (
    <div className={`bg-[#1C1D21] border border-[#2A2C31] rounded-lg p-5 ${className}`}>
      {children}
    </div>
  );
}

function Row({ title, description, children }) {
  return (
    <div className="flex justify-between items-start gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{title}</p>
        {description ? (
          <p className="text-xs text-[#D1D1D1] opacity-70 mt-1 leading-relaxed">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-[#2A2C31]" />;
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="w-11 h-6 bg-[#0A0B0D] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ADE80] border border-[#2A2C31]" />
    </label>
  );
}

function Select({ value, onChange, options, disabled }) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="bg-[#0A0B0D] border border-[#2A2C31] text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-[#4ADE80] disabled:opacity-50 min-w-[200px]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function formatContextLength(value) {
  const numeric = Number(value) || 0;
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M ctx`;
  if (numeric >= 1000) return `${Math.round(numeric / 1000)}K ctx`;
  if (numeric > 0) return `${numeric} ctx`;
  return "ctx n/a";
}

function modelMatchesQuery(model, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [model.id, model.name, model.canonical_slug, model.description]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function getModelBadge(model) {
  const outputs = model?.output_modalities ?? [];
  if (outputs.includes("text")) return "text";
  if (outputs.length > 0) return outputs.join("/");
  return model?.modality || "model";
}

function ModelCatalogPicker({
  disabled,
  error,
  loading,
  models,
  onChange,
  onRefresh,
  query,
  selectedValue,
  setQuery,
}) {
  const currentModel = models.find((model) => model.id === selectedValue);
  const filteredModels = models.filter((model) => modelMatchesQuery(model, query));
  const visibleModels = filteredModels.slice(0, 80);
  const typedModelId = query.trim();
  const canUseTypedModel =
    typedModelId.includes("/") && !models.some((model) => model.id === typedModelId);

  return (
    <div className="w-[440px] max-w-full space-y-2">
      <div className="rounded border border-[#2A2C31] bg-[#0A0B0D] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-widest text-[#D1D1D1] opacity-40">
              Selected model
            </div>
            <div className="mt-1 truncate text-xs font-mono text-white">
              {selectedValue || "No model selected"}
            </div>
            {currentModel ? (
              <div className="mt-1 truncate text-[10px] text-[#D1D1D1]/55">
                {currentModel.name} · {formatContextLength(currentModel.context_length)} · {getModelBadge(currentModel)}
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-[#F27D26]/75">
                Current model is not in the loaded catalog.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="shrink-0 rounded border border-[#2A2C31] bg-[#1C1D21] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-white transition-colors hover:bg-[#2A2C31] disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#D1D1D1]/40" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search live OpenRouter catalog..."
          className="w-full rounded border border-[#2A2C31] bg-[#0A0B0D] py-2 pl-8 pr-3 text-xs text-white placeholder:text-[#D1D1D1]/35 focus:border-[#4ADE80] focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-[#D1D1D1]/40">
        <span>
          {loading
            ? "Fetching catalog"
            : `${filteredModels.length}/${models.length} live models`}
        </span>
        {error ? <span className="text-[#F27D26]">Catalog fetch failed</span> : null}
      </div>

      {error ? (
        <div className="rounded border border-[#F27D26]/30 bg-[#F27D26]/10 px-3 py-2 text-xs text-[#F4B26D]">
          {error}
        </div>
      ) : null}

      <div className="max-h-[280px] overflow-y-auto rounded border border-[#2A2C31] bg-[#0A0B0D]">
        {canUseTypedModel ? (
          <button
            type="button"
            onClick={() => onChange(typedModelId)}
            disabled={disabled}
            className="w-full border-b border-[#2A2C31] px-3 py-2 text-left transition-colors hover:bg-[#1C1D21] disabled:opacity-50"
          >
            <div className="text-xs font-mono text-white">Use typed id: {typedModelId}</div>
            <div className="mt-1 text-[10px] text-[#D1D1D1]/45">
              Manual override if OpenRouter accepts a model before it appears in catalog.
            </div>
          </button>
        ) : null}

        {visibleModels.map((model) => {
          const isSelected = model.id === selectedValue;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onChange(model.id)}
              disabled={disabled}
              className={`w-full border-b border-[#2A2C31] px-3 py-2 text-left transition-colors last:border-b-0 disabled:opacity-50 ${
                isSelected ? "bg-[#4ADE80]/10" : "hover:bg-[#1C1D21]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-white">{model.name || model.id}</div>
                  <div className="mt-1 truncate text-[10px] font-mono text-[#D1D1D1]/50">
                    {model.id}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[#4ADE80]">
                    {getModelBadge(model)}
                  </div>
                  <div className="mt-1 text-[9px] font-mono text-[#D1D1D1]/35">
                    {formatContextLength(model.context_length)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {!loading && visibleModels.length === 0 && !canUseTypedModel ? (
          <div className="px-3 py-5 text-center text-xs text-[#D1D1D1]/45">
            No models match this search.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 text-white mb-4">
      {children}
    </h3>
  );
}

export function Settings({ scrollRef }) {
  const { config, patchConfig, isPatching } = useConfig();
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [llmProviders, setLlmProviders] = useState([]);
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [openRouterModelQuery, setOpenRouterModelQuery] = useState("");
  const [openRouterModelsError, setOpenRouterModelsError] = useState("");
  const [openRouterModelsLoading, setOpenRouterModelsLoading] = useState(false);
  const [llmModelInput, setLlmModelInput] = useState("");
  const [llmBaseUrlInput, setLlmBaseUrlInput] = useState("");
  const [personalContext, setPersonalContext] = useState("");
  const [personalContextSaveState, setPersonalContextSaveState] = useState("idle");
  const [llmTest, setLlmTest] = useState(null);
  const [whisperTest, setWhisperTest] = useState(null);
  const [llmTesting, setLlmTesting] = useState(false);
  const [whisperTesting, setWhisperTesting] = useState(false);
  const lastSyncedPersonalContextRef = useRef("");
  const patchConfigRef = useRef(patchConfig);
  const pushToastRef = useRef(pushToast);

  useEffect(() => {
    patchConfigRef.current = patchConfig;
    pushToastRef.current = pushToast;
  }, [patchConfig, pushToast]);

  useEffect(() => {
    if (!config) return;

    const previousSynced = lastSyncedPersonalContextRef.current;
    const nextSynced = config.personal_context ?? "";
    const canSyncFromConfig = personalContext === previousSynced || previousSynced === "";

    lastSyncedPersonalContextRef.current = nextSynced;
    if (canSyncFromConfig) {
      setPersonalContext(nextSynced);
      setPersonalContextSaveState("idle");
    }
  }, [config?.personal_context]);

  useEffect(() => {
    setLlmModelInput(config?.llm?.model ?? "");
    setLlmBaseUrlInput(config?.llm?.base_url ?? "");
  }, [config?.llm?.model, config?.llm?.base_url]);

  useEffect(() => {
    const savedContext = config?.personal_context ?? "";
    if (!config) return undefined;

    if (personalContext === savedContext) {
      return undefined;
    }

    setPersonalContextSaveState("pending");
    const timeoutId = window.setTimeout(() => {
      setPersonalContextSaveState("saving");
      patchConfigRef.current({ personal_context: personalContext })
        .then(() => {
          setPersonalContextSaveState("saved");
        })
        .catch((error) => {
          setPersonalContextSaveState("error");
          pushToastRef.current({
            kind: "error",
            message: error instanceof Error ? error.message : "Failed to autosave context.",
          });
        });
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [config?.personal_context, personalContext]);

  useEffect(() => {
    if (activeTab !== "ai") return;
    void refreshLlmProviders();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "ai") return;
    if ((config?.llm?.provider ?? "openrouter") !== "openrouter") return;
    if (openRouterModels.length > 0) return;
    void refreshOpenRouterModels({ silent: true });
  }, [activeTab, config?.llm?.provider, openRouterModels.length]);

  async function refreshLlmProviders() {
    try {
      const payload = await loadLlmProviders();
      setLlmProviders(Array.isArray(payload?.providers) ? payload.providers : []);
    } catch {
      setLlmProviders([]);
    }
  }

  async function refreshOpenRouterModels({ silent = false } = {}) {
    setOpenRouterModelsLoading(true);
    setOpenRouterModelsError("");

    try {
      const models = await loadOpenRouterModels();
      const nextModels = Array.isArray(models) ? models : [];
      setOpenRouterModels(nextModels);
      if (!silent) {
        pushToast({ kind: "success", message: `Loaded ${nextModels.length} OpenRouter models.` });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load OpenRouter model catalog.";
      setOpenRouterModelsError(message);
      if (!silent) {
        pushToast({ kind: "error", message });
      }
    } finally {
      setOpenRouterModelsLoading(false);
    }
  }

  async function applyPatch(patch, successMessage) {
    try {
      await patchConfig(patch);
      if (successMessage) pushToast({ kind: "success", message: successMessage });
    } catch (error) {
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to update setting.",
      });
    }
  }

  async function handleTestLlm() {
    setLlmTesting(true);
    setLlmTest(null);
    try {
      const result = await testLlm();
      setLlmTest(result);
      pushToast({ kind: "success", message: "AI provider connection works." });
    } catch (error) {
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "AI provider test failed.",
      });
    } finally {
      setLlmTesting(false);
    }
  }

  async function handleTestWhisper() {
    setWhisperTesting(true);
    setWhisperTest(null);
    try {
      const result = await testWhisper();
      setWhisperTest(result);
      pushToast({ kind: "success", message: "Whisper smoke test passed." });
    } catch (error) {
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Whisper test failed.",
      });
    } finally {
      setWhisperTesting(false);
    }
  }

  async function handleSaveApiKey() {
    if (!openRouterApiKey.trim()) {
      pushToast({ kind: "error", message: "Enter an API key first." });
      return;
    }
    await applyPatch(
      { llm: { api_key: openRouterApiKey.trim() } },
      "AI provider API key saved.",
    );
    setOpenRouterApiKey("");
  }

  async function handlePickJournalFolder() {
    try {
      const folder = await chooseDirectory();
      if (folder) {
        await applyPatch({ journal_folder: folder }, "Journal folder updated.");
      }
    } catch (error) {
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to pick folder.",
      });
    }
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#E0E0E0] opacity-60">
        <Loader2 size={20} className="animate-spin" />
        <p className="mt-2 text-xs uppercase tracking-widest">Loading settings…</p>
      </div>
    );
  }

  const llmProvider = config.llm?.provider ?? "openrouter";
  const providerOptions = (llmProviders.length > 0 ? llmProviders : [
    { id: "openrouter", label: "OpenRouter" },
    { id: "opencode_go", label: "OpenCode Go" },
    { id: "openai_compatible", label: "OpenAI-compatible" },
    { id: "litellm_proxy", label: "LiteLLM proxy" },
  ]).map((provider) => ({ value: provider.id, label: provider.label }));
  const activeProvider = llmProviders.find((provider) => provider.id === llmProvider);
  const opencodeModels = activeProvider?.models ?? OPENCODE_GO_MODELS;
  const fixedProviderUrl =
    llmProvider === "opencode_go"
      ? activeProvider?.base_url ?? "https://opencode.ai/zen/go/v1"
      : "";
  const needsBaseUrl = llmProvider === "openai_compatible" || llmProvider === "litellm_proxy";
  const currentLlmConfigured =
    (config.llm?.provider_configured?.[llmProvider] ?? config.llm?.configured ?? false) ||
    llmProvider === "litellm_proxy";
  const currentLlmMaskedKey =
    config.llm?.provider_api_keys?.[llmProvider] ??
    (llmProvider === config.llm?.provider ? config.llm?.api_key : "");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0F1012]">
      <header className="h-16 border-b border-[#2A2C31] flex items-center px-8 bg-[#151619] shrink-0 justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-white">Settings</h2>
        {isPatching ? (
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-60 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        ) : null}
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r border-[#2A2C31] bg-[#151619] p-4 shrink-0 flex flex-col gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`text-left px-4 py-2 rounded text-xs font-semibold uppercase tracking-widest transition-colors ${
                activeTab === tab.id
                  ? "bg-[#2A2C31] text-white"
                  : "text-[#E0E0E0] opacity-40 hover:opacity-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto" key={activeTab}>
            {activeTab === "general" ? (
              <div className="space-y-8 praxis-fade-in">
                <section>
                  <SectionTitle>Transcription Language</SectionTitle>
                  <Card>
                    <Row
                      title="Default Language"
                      description="Language preselected for new takes."
                    >
                      <Select
                        value={config.language_default}
                        options={LANGUAGE_OPTIONS}
                        onChange={(value) =>
                          applyPatch({ language_default: value }, "Default language updated.")
                        }
                      />
                    </Row>
                  </Card>
                </section>

                <section>
                  <SectionTitle>Personal Context</SectionTitle>
                  <Card className="space-y-4">
                    <p className="text-xs text-[#D1D1D1] opacity-70 leading-relaxed">
                      The system prompt used to give the LLM context about you. Be precise —
                      it shapes every analysis.
                    </p>
                    <textarea
                      value={personalContext}
                      onChange={(event) => setPersonalContext(event.target.value)}
                      rows={10}
                      className="w-full bg-[#0A0B0D] border border-[#2A2C31] rounded p-3 text-xs text-[#E0E0E0] font-mono leading-relaxed focus:outline-none focus:border-[#4ADE80] resize-y"
                    />
                    <div className="flex justify-end">
                      <div className="min-h-6 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1] opacity-70">
                        {personalContextSaveState === "pending" ? "Autosaves in 1s" : null}
                        {personalContextSaveState === "saving" ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Saving context
                          </>
                        ) : null}
                        {personalContextSaveState === "saved" ? (
                          <>
                            <Check size={12} className="text-[#4ADE80]" />
                            Context saved
                          </>
                        ) : null}
                        {personalContextSaveState === "error" ? (
                          <span className="text-red-400">Autosave failed</span>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </section>

                <section>
                  <SectionTitle>Notifications</SectionTitle>
                  <Card>
                    <Row
                      title="Ready Sound"
                      description="Play a soft chime when a recording finishes processing."
                    >
                      <Toggle
                        checked={config.ready_sound_enabled}
                        onChange={(value) =>
                          applyPatch(
                            { ready_sound_enabled: value },
                            value ? "Ready sound on." : "Ready sound off.",
                          )
                        }
                      />
                    </Row>
                  </Card>
                </section>
              </div>
            ) : null}

            {activeTab === "recording" ? (
              <div className="space-y-8 praxis-fade-in">
                <section>
                  <SectionTitle>Video Quality</SectionTitle>
                  <Card>
                    <Row
                      title="Capture quality"
                      description="Higher quality looks better but uses more storage."
                    >
                      <Select
                        value={config.video_quality}
                        options={VIDEO_QUALITY_OPTIONS}
                        onChange={(value) =>
                          applyPatch({ video_quality: value }, "Video quality updated.")
                        }
                      />
                    </Row>
                  </Card>
                </section>

                <section>
                  <SectionTitle>Coaching Tone</SectionTitle>
                  <Card>
                    <Row
                      title="Directness"
                      description="How blunt the LLM is when calling out flaws."
                    >
                      <Select
                        value={config.directness}
                        options={DIRECTNESS_OPTIONS}
                        onChange={(value) =>
                          applyPatch({ directness: value }, "Directness updated.")
                        }
                      />
                    </Row>
                  </Card>
                </section>
              </div>
            ) : null}

            {activeTab === "ai" ? (
              <div className="space-y-8 praxis-fade-in">
                <section>
                  <SectionTitle>AI Provider</SectionTitle>
                  <Card className="space-y-5">
                    <Row
                      title="Provider"
                      description="Choose which API Praxis uses for coaching analysis, reports, and subtitle translation."
                    >
                      <Select
                        value={llmProvider}
                        options={providerOptions}
                        disabled={isPatching}
                        onChange={(value) => {
                          const defaults =
                            value === "opencode_go"
                              ? { model: "glm-5.1", base_url: "" }
                              : value === "openrouter"
                                ? {
                                    model:
                                      config.openrouter?.default_model ??
                                      "google/gemini-2.5-flash-lite",
                                    base_url: "",
                                  }
                                : { model: config.llm?.model ?? "", base_url: config.llm?.base_url ?? "" };
                          applyPatch(
                            { llm: { provider: value, ...defaults } },
                            "AI provider updated.",
                          );
                        }}
                      />
                    </Row>

                    <Divider />

                    <Row
                      title="API Key"
                      description={
                        currentLlmConfigured
                          ? `Currently configured: ${currentLlmMaskedKey || "saved"}`
                          : "Required to run analysis with the selected provider."
                      }
                    >
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={openRouterApiKey}
                          onChange={(event) => setOpenRouterApiKey(event.target.value)}
                          placeholder={llmProvider === "openrouter" ? "sk-or-..." : "API key"}
                          className="bg-[#0A0B0D] border border-[#2A2C31] text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-[#4ADE80] w-[220px]"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveApiKey()}
                          disabled={isPatching || !openRouterApiKey.trim()}
                          className="px-3 py-1.5 bg-[#2A2C31] hover:bg-[#32353B] rounded text-xs font-semibold uppercase tracking-widest text-white transition-colors disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </Row>

                    <Divider />

                    {llmProvider === "openrouter" ? (
                      <Row
                        title="Model"
                        description="Fetched live from the OpenRouter catalog. Search and choose any model id."
                      >
                        <ModelCatalogPicker
                          selectedValue={config.llm?.model ?? config.openrouter?.default_model ?? ""}
                          models={openRouterModels}
                          loading={openRouterModelsLoading}
                          error={openRouterModelsError}
                          query={openRouterModelQuery}
                          setQuery={setOpenRouterModelQuery}
                          disabled={isPatching}
                          onRefresh={() => void refreshOpenRouterModels()}
                          onChange={(value) =>
                            applyPatch(
                              { llm: { model: value } },
                              `AI model set to ${value}.`,
                            )
                          }
                        />
                      </Row>
                    ) : null}

                    {llmProvider === "opencode_go" ? (
                      <Row
                        title="Model"
                        description={`Uses the fixed OpenCode Go endpoint: ${fixedProviderUrl}`}
                      >
                        <Select
                          value={config.llm?.model ?? "glm-5.1"}
                          options={opencodeModels.map((model) => ({ value: model, label: model }))}
                          disabled={isPatching}
                          onChange={(value) =>
                            applyPatch({ llm: { model: value } }, `AI model set to ${value}.`)
                          }
                        />
                      </Row>
                    ) : null}

                    {llmProvider !== "openrouter" && llmProvider !== "opencode_go" ? (
                      <Row
                        title="Model"
                        description="Exact model name accepted by your compatible API or LiteLLM proxy."
                      >
                        <input
                          type="text"
                          value={llmModelInput}
                          onChange={(event) => setLlmModelInput(event.target.value)}
                          onBlur={() => {
                            if (llmModelInput !== (config.llm?.model ?? "")) {
                              applyPatch(
                                { llm: { model: llmModelInput } },
                                "AI model updated.",
                              );
                            }
                          }}
                          placeholder="model id"
                          className="bg-[#0A0B0D] border border-[#2A2C31] text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-[#4ADE80] w-[300px]"
                        />
                      </Row>
                    ) : null}

                    {needsBaseUrl ? (
                      <>
                        <Divider />
                        <Row
                          title="Base URL"
                          description="Use the root /v1 URL, for example https://api.example.com/v1."
                        >
                          <input
                            type="url"
                            value={llmBaseUrlInput}
                            onChange={(event) => setLlmBaseUrlInput(event.target.value)}
                            onBlur={() => {
                              if (llmBaseUrlInput !== (config.llm?.base_url ?? "")) {
                                applyPatch(
                                  { llm: { base_url: llmBaseUrlInput } },
                                  "AI base URL updated.",
                                );
                              }
                            }}
                            placeholder="https://.../v1"
                            className="bg-[#0A0B0D] border border-[#2A2C31] text-xs text-white rounded px-3 py-1.5 focus:outline-none focus:border-[#4ADE80] w-[300px]"
                          />
                        </Row>
                      </>
                    ) : null}

                    <Divider />

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">Connection Test</p>
                        {llmTest ? (
                          <p className="text-xs text-[#4ADE80] opacity-90 mt-1">
                            {llmTest.model}
                          </p>
                        ) : (
                          <p className="text-xs text-[#D1D1D1] opacity-70 mt-1">
                            Sends one small JSON request through the selected provider.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTestLlm()}
                        disabled={llmTesting || !currentLlmConfigured}
                        className="px-3 py-1.5 bg-[#1C1D21] hover:bg-[#2A2C31] border border-[#2A2C31] rounded text-xs font-semibold uppercase tracking-widest text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {llmTesting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Test
                      </button>
                    </div>
                  </Card>
                </section>

                <section>
                  <SectionTitle>Whisper (Local)</SectionTitle>
                  <Card className="space-y-5">
                    <Row title="Model" description="Larger models = more accurate, slower.">
                      <Select
                        value={config.whisper?.model}
                        options={WHISPER_MODELS.map((m) => ({ value: m, label: m }))}
                        onChange={(value) =>
                          applyPatch(
                            { whisper: { model: value } },
                            "Whisper model updated.",
                          )
                        }
                      />
                    </Row>

                    <Row title="Compute Type" description="Quantization tradeoff.">
                      <Select
                        value={config.whisper?.compute_type}
                        options={[
                          { value: "int8", label: "int8" },
                          { value: "int8_float16", label: "int8_float16" },
                          { value: "float16", label: "float16" },
                          { value: "float32", label: "float32" },
                        ]}
                        onChange={(value) =>
                          applyPatch(
                            { whisper: { compute_type: value } },
                            "Compute type updated.",
                          )
                        }
                      />
                    </Row>

                    <Row title="Device" description="CPU is the safe default.">
                      <Select
                        value={config.whisper?.device}
                        options={[
                          { value: "cpu", label: "CPU" },
                          { value: "cuda", label: "CUDA" },
                          { value: "auto", label: "Auto" },
                        ]}
                        onChange={(value) =>
                          applyPatch(
                            { whisper: { device: value } },
                            "Whisper device updated.",
                          )
                        }
                      />
                    </Row>

                    <Divider />

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">Smoke Test</p>
                        {whisperTest ? (
                          <p className="text-xs text-[#4ADE80] opacity-90 mt-1 font-mono">
                            {whisperTest.engine} · {whisperTest.model} ·{" "}
                            {whisperTest.transcribe_seconds?.toFixed?.(2) ?? whisperTest.transcribe_seconds}s
                          </p>
                        ) : (
                          <p className="text-xs text-[#D1D1D1] opacity-70 mt-1">
                            Run a quick transcription to verify the install.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTestWhisper()}
                        disabled={whisperTesting}
                        className="px-3 py-1.5 bg-[#1C1D21] hover:bg-[#2A2C31] border border-[#2A2C31] rounded text-xs font-semibold uppercase tracking-widest text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {whisperTesting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        Test
                      </button>
                    </div>
                  </Card>
                </section>
              </div>
            ) : null}

            {activeTab === "storage" ? (
              <div className="space-y-8 praxis-fade-in">
                <section>
                  <SectionTitle>Journal Folder</SectionTitle>
                  <Card className="space-y-4">
                    <Row
                      title="Location"
                      description="Where Praxis stores all takes, transcripts, and analyses."
                    >
                      <button
                        type="button"
                        onClick={() => void handlePickJournalFolder()}
                        className="px-3 py-1.5 bg-[#1C1D21] hover:bg-[#2A2C31] border border-[#2A2C31] rounded text-xs font-semibold uppercase tracking-widest text-white transition-colors flex items-center gap-2"
                      >
                        <FolderOpen size={12} />
                        Choose…
                      </button>
                    </Row>
                    <div className="text-[11px] font-mono opacity-60 text-[#D1D1D1] break-all">
                      {config.journal_folder}
                    </div>
                    <button
                      type="button"
                      onClick={() => void openDesktopPath(config.journal_folder)}
                      className="text-[11px] font-mono uppercase tracking-widest text-[#4ADE80] opacity-80 hover:opacity-100 self-start"
                    >
                      Open in file manager
                    </button>
                  </Card>
                </section>

                <section>
                  <SectionTitle>Retention</SectionTitle>
                  <Card>
                    <Row
                      title="Auto-trim videos"
                      description="Keep transcripts forever, drop the heavy video file after this many days. 0 = keep forever."
                    >
                      <Select
                        value={String(config.retention_days)}
                        options={[
                          { value: "0", label: "Keep forever" },
                          ...RETENTION_OPTIONS.map((d) => ({ value: String(d), label: `${d} days` })),
                        ]}
                        onChange={(value) =>
                          applyPatch(
                            { retention_days: Number(value) },
                            "Retention updated.",
                          )
                        }
                      />
                    </Row>
                  </Card>
                </section>
              </div>
            ) : null}

            {activeTab === "advanced" ? (
              <div className="space-y-8 praxis-fade-in">
                <section>
                  <SectionTitle>Telegram</SectionTitle>
                  <Card className="space-y-4 opacity-55">
                    <Row
                      title="Telegram digest"
                      description="Phase 2 placeholder. Daily and weekly message delivery is disabled in this build."
                    >
                      <Toggle checked={false} disabled onChange={() => {}} />
                    </Row>
                    <div className="grid grid-cols-1 gap-2 text-[11px] font-mono text-[#D1D1D1]/60 md:grid-cols-2">
                      <div className="rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2">
                        Daily digest · 08:00
                      </div>
                      <div className="rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2">
                        Weekly rollup · Sunday 20:00
                      </div>
                    </div>
                  </Card>
                </section>

                <section>
                  <SectionTitle>Phone Upload</SectionTitle>
                  <Card>
                    <Row
                      title="Allow phone upload"
                      description="Experimental — accept recordings from a phone on the local network."
                    >
                      <Toggle
                        checked={config.phone_upload_enabled}
                        onChange={(value) =>
                          applyPatch(
                            { phone_upload_enabled: value },
                            value ? "Phone upload on." : "Phone upload off.",
                          )
                        }
                      />
                    </Row>
                    {config.phone_upload_enabled && config.phone_upload_url ? (
                      <div className="mt-4 pt-4 border-t border-[#2a2c31] flex flex-col items-center gap-3">
                        <QRCodeSVG
                          value={config.phone_upload_url}
                          size={160}
                          bgColor="#151619"
                          fgColor="#f5f5f0"
                          level="M"
                        />
                        <div className="text-[11px] font-mono text-[#a8a8a8] break-all text-center max-w-[280px]">
                          {config.phone_upload_url}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </section>

                <section>
                  <SectionTitle>About</SectionTitle>
                  <Card className="space-y-2 text-[11px] font-mono text-[#D1D1D1] opacity-80">
                    <div className="flex justify-between gap-6">
                      <span className="opacity-60 uppercase tracking-widest">App</span>
                      <span>{config.app_version}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="opacity-60 uppercase tracking-widest">Schema</span>
                      <span>v{config.schema_version}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="opacity-60 uppercase tracking-widest">Theme</span>
                      <span>{config.theme}</span>
                    </div>
                    {config.config_path ? (
                      <div className="flex justify-between gap-6 break-all">
                        <span className="opacity-60 uppercase tracking-widest shrink-0">Config</span>
                        <span className="text-right">{config.config_path}</span>
                      </div>
                    ) : null}
                    {config.logs_path ? (
                      <div className="flex justify-between gap-6 break-all">
                        <span className="opacity-60 uppercase tracking-widest shrink-0">Logs</span>
                        <span className="text-right">{config.logs_path}</span>
                      </div>
                    ) : null}
                  </Card>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
