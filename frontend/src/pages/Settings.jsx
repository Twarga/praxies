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
import { useTheme } from "../hooks/useTheme.js";
import { useToast } from "../hooks/useToast.js";
import { chooseDirectory, openDesktopPath } from "../lib/desktop.js";
import { ProviderConnectionsPanel } from "../components/praxis/ProviderConnectionsPanel.jsx";
import { TranscriptionSettingsPanel } from "../components/praxis/TranscriptionSettingsPanel.jsx";
import { DogfoodSummary } from "../components/praxis/DogfoodSummary.jsx";
import { DiagnosticsPanel } from "../components/praxis/DiagnosticsPanel.jsx";
import { ThemePicker } from "../components/praxis/ThemePicker.jsx";

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

const WHISPER_MODELS = []

const DIRECTNESS_OPTIONS = [
  { value: "gentle", label: "Gentle" },
  { value: "direct", label: "Direct" },
  { value: "brutal", label: "Brutal" },
];

const OPENCODE_GO_MODELS = []

const TABS = [
  { id: "general", label: "General" },
  { id: "recording", label: "Recording" },
  { id: "transcription", label: "Transcription" },
  { id: "ai", label: "AI & Processing" },
  { id: "storage", label: "Storage" },
  { id: "trial", label: "Trial Feedback" },
  { id: "system", label: "System Health" },
  { id: "advanced", label: "Advanced" },
];

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5 ${className}`}>
      {children}
    </div>
  );
}

function Row({ title, description, children }) {
  return (
    <div className="flex justify-between items-start gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--praxis-text-primary)]">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--praxis-text-secondary)]">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-[var(--praxis-line-subtle)]" />;
}

function Toggle({ checked, onChange, disabled, ariaLabel }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        aria-label={ariaLabel}
        className="sr-only peer"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <div className="w-11 h-6 bg-[var(--praxis-bg-app)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[var(--praxis-text-primary)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--praxis-text-primary)] after:border-[var(--praxis-line-strong)] after:border after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:bg-[var(--praxis-success)] border border-[var(--praxis-line-subtle)]" />
    </label>
  );
}

function Select({ value, onChange, options, disabled }) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-w-[200px] rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-canvas)] px-3 py-1.5 text-xs text-[var(--praxis-text-primary)] focus:border-[var(--praxis-accent)] focus:outline-none disabled:opacity-50"
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
      <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-secondary)]">
              Selected model
            </div>
            <div className="mt-1 truncate text-xs font-mono text-[var(--praxis-text-primary)]">
              {selectedValue || "No model selected"}
            </div>
            {currentModel ? (
              <div className="mt-1 truncate text-[10px] text-[var(--praxis-text-muted)]">
                {currentModel.name} · {formatContextLength(currentModel.context_length)} · {getModelBadge(currentModel)}
              </div>
            ) : (
              <div className="mt-1 text-[10px] text-[var(--praxis-warning)]/75">
                Current model is not in the loaded catalog.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="shrink-0 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors hover:bg-[var(--praxis-line-subtle)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--praxis-text-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search live OpenRouter catalog..."
          className="w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] py-2 pl-8 pr-3 text-xs text-[var(--praxis-text-primary)] placeholder:text-[var(--praxis-text-muted)] focus:border-[var(--praxis-success)] focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
        <span>
          {loading
            ? "Fetching catalog"
            : `${filteredModels.length}/${models.length} live models`}
        </span>
        {error ? <span className="text-[var(--praxis-warning)]">Catalog fetch failed</span> : null}
      </div>

      {error ? (
        <div className="rounded border border-[var(--praxis-warning)]/30 bg-[var(--praxis-warning)]/10 px-3 py-2 text-xs text-[var(--praxis-warning)]">
          {error}
        </div>
      ) : null}

      <div className="max-h-[280px] overflow-y-auto rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)]">
        {canUseTypedModel ? (
          <button
            type="button"
            onClick={() => onChange(typedModelId)}
            disabled={disabled}
            className="w-full border-b border-[var(--praxis-line-subtle)] px-3 py-2 text-left transition-colors hover:bg-[var(--praxis-bg-panel-raised)] disabled:opacity-50"
          >
            <div className="text-xs font-mono text-[var(--praxis-text-primary)]">Use typed id: {typedModelId}</div>
            <div className="mt-1 text-[10px] text-[var(--praxis-text-muted)]">
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
              className={`w-full border-b border-[var(--praxis-line-subtle)] px-3 py-2 text-left transition-colors last:border-b-0 disabled:opacity-50 ${
                isSelected ? "bg-[var(--praxis-success)]/10" : "hover:bg-[var(--praxis-bg-panel-raised)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-[var(--praxis-text-primary)]">{model.name || model.id}</div>
                  <div className="mt-1 truncate text-[10px] font-mono text-[var(--praxis-text-muted)]">
                    {model.id}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-success)]">
                    {getModelBadge(model)}
                  </div>
                  <div className="mt-1 text-[9px] font-mono text-[var(--praxis-text-muted)]">
                    {formatContextLength(model.context_length)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {!loading && visibleModels.length === 0 && !canUseTypedModel ? (
          <div className="px-3 py-5 text-center text-xs text-[var(--praxis-text-muted)]">
            No models match this search.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="mb-4 text-sm font-semibold text-[var(--praxis-text-primary)]">
      {children}
    </h3>
  );
}

export function Settings({ scrollRef }) {
  const { config, patchConfig, isPatching } = useConfig();
  const { theme, setTheme, themes } = useTheme();
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [navWidth, setNavWidth] = useState(() => Number(window.localStorage.getItem("praxis.settings.split")) || 208);
  const settingsRef = useRef(null);
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

  useEffect(() => window.localStorage.setItem("praxis.settings.split", String(navWidth)), [navWidth]);

  function beginSettingsResize(event) {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    function move(pointerEvent) {
      const bounds = settingsRef.current?.getBoundingClientRect();
      if (!bounds) return;
      setNavWidth(Math.max(180, Math.min(300, pointerEvent.clientX - bounds.left)));
    }
    function end() { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  }

  const visibleTabs = TABS.filter((tab) => `${tab.label} ${tab.id}`.toLowerCase().includes(settingsSearch.trim().toLowerCase()));

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
      <div className="flex flex-col items-center justify-center h-full text-[var(--praxis-text-muted)]">
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
    <div className="flex h-full flex-col overflow-hidden bg-[var(--praxis-bg-canvas)]">
      <header className="praxis-glass-chrome flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--praxis-line-subtle)] px-6">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--praxis-text-primary)]">Settings</h2>
        <div className="flex items-center gap-3"><input value={settingsSearch} onChange={(event) => setSettingsSearch(event.target.value)} placeholder="Search settings" aria-label="Search settings" className="hidden h-8 w-48 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 text-xs text-[var(--praxis-text-primary)] outline-none placeholder:text-[var(--praxis-text-muted)] focus:border-[var(--praxis-accent)] md:block" />{isPatching ? (
          <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
            <Loader2 size={12} className="animate-spin" /> Saving…
          </span>
        ) : <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">Saved locally</span>}</div>
      </header>

      <div ref={settingsRef} className="flex flex-1 overflow-hidden">
        <div role="tablist" aria-label="Settings sections" aria-orientation="vertical" style={{ flex: `0 0 ${navWidth}px` }} className="praxis-glass-chrome flex min-w-[180px] flex-col gap-1 border-r border-[var(--praxis-line-subtle)] p-3">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls="settings-panel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const index = TABS.findIndex((item) => item.id === activeTab);
                const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + TABS.length) % TABS.length;
                setActiveTab(TABS[nextIndex].id);
                requestAnimationFrame(() => document.getElementById(`settings-tab-${TABS[nextIndex].id}`)?.focus());
              }}
              className={`rounded px-3 py-2 text-left text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]"
                  : "text-[var(--praxis-text-muted)] hover:bg-[var(--praxis-hover)] hover:text-[var(--praxis-text-primary)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {!visibleTabs.length ? <p className="px-3 py-2 text-xs text-[var(--praxis-text-muted)]">No settings section matches.</p> : null}
        </div>

        <div role="separator" aria-label="Resize settings navigation" aria-orientation="vertical" tabIndex={0} onPointerDown={beginSettingsResize} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setNavWidth((value) => Math.max(180, value - 8)); } if (event.key === "ArrowRight") { event.preventDefault(); setNavWidth((value) => Math.min(300, value + 8)); } }} className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-[var(--praxis-line-subtle)] outline-none hover:bg-[var(--praxis-accent)] focus:bg-[var(--praxis-accent)]"><span className="absolute left-1/2 top-1/2 h-9 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--praxis-bg-elevated)] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" /></div>

        <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`} ref={scrollRef} className="flex-1 overflow-y-auto p-8">
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
                    <p className="text-xs text-[var(--praxis-text-secondary)] leading-relaxed">
                      The system prompt used to give the LLM context about you. Be precise —
                      it shapes every analysis.
                    </p>
                    <textarea
                      value={personalContext}
                      onChange={(event) => setPersonalContext(event.target.value)}
                      rows={10}
                      className="w-full bg-[var(--praxis-bg-app)] border border-[var(--praxis-line-subtle)] rounded p-3 text-xs text-[var(--praxis-text-primary)] font-mono leading-relaxed focus:outline-none focus:border-[var(--praxis-success)] resize-y"
                    />
                    <div className="flex justify-end">
                      <div className="min-h-6 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-secondary)]">
                        {personalContextSaveState === "pending" ? "Autosaves in 1s" : null}
                        {personalContextSaveState === "saving" ? (
                          <>
                            <Loader2 size={12} className="animate-spin" />
                            Saving context
                          </>
                        ) : null}
                        {personalContextSaveState === "saved" ? (
                          <>
                            <Check size={12} className="text-[var(--praxis-success)]" />
                            Context saved
                          </>
                        ) : null}
                        {personalContextSaveState === "error" ? (
                          <span className="text-[var(--praxis-danger)]">Autosave failed</span>
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
                        ariaLabel="Ready sound"
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

                <section>
                  <SectionTitle>Theme</SectionTitle>
                  <ThemePicker themes={themes} theme={theme} onChange={setTheme} />
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

            {activeTab === "ai" ? <ProviderConnectionsPanel pushToast={pushToast} /> : null}
            {activeTab === "transcription" ? <TranscriptionSettingsPanel activeModel={config.whisper?.model} pushToast={pushToast} /> : null}
            {activeTab === "trial" ? <DogfoodSummary pushToast={pushToast} /> : null}
            {activeTab === "system" ? <DiagnosticsPanel pushToast={pushToast} /> : null}
            {false ? (
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
                              ? { model: "", base_url: "" }
                              : value === "openrouter"
                                ? {
                                    model: config.openrouter?.default_model ?? "",
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
                          className="bg-[var(--praxis-bg-app)] border border-[var(--praxis-line-subtle)] text-xs text-[var(--praxis-text-primary)] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--praxis-success)] w-[220px]"
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveApiKey()}
                          disabled={isPatching || !openRouterApiKey.trim()}
                          className="px-3 py-1.5 bg-[var(--praxis-line-subtle)] hover:bg-[var(--praxis-hover)] rounded text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors disabled:opacity-50"
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
                          value={config.llm?.model ?? ""}
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
                          className="bg-[var(--praxis-bg-app)] border border-[var(--praxis-line-subtle)] text-xs text-[var(--praxis-text-primary)] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--praxis-success)] w-[300px]"
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
                            className="bg-[var(--praxis-bg-app)] border border-[var(--praxis-line-subtle)] text-xs text-[var(--praxis-text-primary)] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--praxis-success)] w-[300px]"
                          />
                        </Row>
                      </>
                    ) : null}

                    <Divider />

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-[var(--praxis-text-primary)] font-medium">Connection Test</p>
                        {llmTest ? (
                          <p className="text-xs text-[var(--praxis-success)] opacity-90 mt-1">
                            {llmTest.model}
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--praxis-text-secondary)] mt-1">
                            Sends one small JSON request through the selected provider.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTestLlm()}
                        disabled={llmTesting || !currentLlmConfigured}
                        className="px-3 py-1.5 bg-[var(--praxis-bg-panel-raised)] hover:bg-[var(--praxis-line-subtle)] border border-[var(--praxis-line-subtle)] rounded text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors disabled:opacity-50 flex items-center gap-2"
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
                        <p className="text-sm text-[var(--praxis-text-primary)] font-medium">Smoke Test</p>
                        {whisperTest ? (
                          <p className="text-xs text-[var(--praxis-success)] opacity-90 mt-1 font-mono">
                            {whisperTest.engine} · {whisperTest.model} ·{" "}
                            {whisperTest.transcribe_seconds?.toFixed?.(2) ?? whisperTest.transcribe_seconds}s
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--praxis-text-secondary)] mt-1">
                            Run a quick transcription to verify the install.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTestWhisper()}
                        disabled={whisperTesting}
                        className="px-3 py-1.5 bg-[var(--praxis-bg-panel-raised)] hover:bg-[var(--praxis-line-subtle)] border border-[var(--praxis-line-subtle)] rounded text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors disabled:opacity-50 flex items-center gap-2"
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
                        className="px-3 py-1.5 bg-[var(--praxis-bg-panel-raised)] hover:bg-[var(--praxis-line-subtle)] border border-[var(--praxis-line-subtle)] rounded text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors flex items-center gap-2"
                      >
                        <FolderOpen size={12} />
                        Choose…
                      </button>
                    </Row>
                    <div className="text-[11px] font-mono opacity-60 text-[var(--praxis-text-secondary)] break-all">
                      {config.journal_folder}
                    </div>
                    <button
                      type="button"
                      onClick={() => void openDesktopPath(config.journal_folder)}
                      className="text-[11px] font-mono uppercase tracking-widest text-[var(--praxis-success)] opacity-80 hover:opacity-100 self-start"
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
                      <Toggle ariaLabel="Telegram digest" checked={false} disabled onChange={() => {}} />
                    </Row>
                    <div className="grid grid-cols-1 gap-2 text-[11px] font-mono text-[var(--praxis-text-muted)] md:grid-cols-2">
                      <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2">
                        Daily digest · 08:00
                      </div>
                      <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2">
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
                        ariaLabel="Allow phone upload"
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
                      <div className="mt-4 pt-4 border-t border-[var(--praxis-line-subtle)] flex flex-col items-center gap-3">
                        <QRCodeSVG
                          value={config.phone_upload_url}
                          size={160}
                          bgColor="var(--praxis-bg-panel)"
                          fgColor="var(--praxis-text-primary)"
                          level="M"
                        />
                        <div className="text-[11px] font-mono text-[var(--praxis-text-secondary)] break-all text-center max-w-[280px]">
                          {config.phone_upload_url}
                        </div>
                      </div>
                    ) : null}
                  </Card>
                </section>

                <section>
                  <SectionTitle>About</SectionTitle>
                  <Card className="space-y-2 text-[11px] font-mono text-[var(--praxis-text-secondary)]">
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
