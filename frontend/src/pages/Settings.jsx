import { Check, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadOpenRouterModels,
  testOpenRouter,
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

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 text-white mb-4">
      {children}
    </h3>
  );
}

export function Settings() {
  const { config, patchConfig, isPatching } = useConfig();
  const { pushToast } = useToast();
  const [activeTab, setActiveTab] = useState("general");
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [openRouterApiKey, setOpenRouterApiKey] = useState("");
  const [personalContext, setPersonalContext] = useState("");
  const [openRouterTest, setOpenRouterTest] = useState(null);
  const [whisperTest, setWhisperTest] = useState(null);
  const [openRouterTesting, setOpenRouterTesting] = useState(false);
  const [whisperTesting, setWhisperTesting] = useState(false);

  useEffect(() => {
    setPersonalContext(config?.personal_context ?? "");
  }, [config?.personal_context]);

  useEffect(() => {
    if (activeTab !== "ai") return;
    if (openRouterModels.length > 0) return;
    loadOpenRouterModels()
      .then((models) => setOpenRouterModels(Array.isArray(models) ? models : []))
      .catch(() => setOpenRouterModels([]));
  }, [activeTab, openRouterModels.length]);

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

  async function handleTestOpenRouter() {
    setOpenRouterTesting(true);
    setOpenRouterTest(null);
    try {
      const result = await testOpenRouter();
      setOpenRouterTest(result);
      pushToast({ kind: "success", message: "OpenRouter connection works." });
    } catch (error) {
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "OpenRouter test failed.",
      });
    } finally {
      setOpenRouterTesting(false);
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

  async function handleSavePersonalContext() {
    await applyPatch({ personal_context: personalContext }, "Personal context saved.");
  }

  async function handleSaveApiKey() {
    if (!openRouterApiKey.trim()) {
      pushToast({ kind: "error", message: "Enter an API key first." });
      return;
    }
    await applyPatch(
      { openrouter: { api_key: openRouterApiKey.trim() } },
      "OpenRouter API key saved.",
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

        <div className="flex-1 p-8 overflow-y-auto">
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
                      <button
                        type="button"
                        onClick={() => void handleSavePersonalContext()}
                        disabled={isPatching || personalContext === config.personal_context}
                        className="px-3 py-1.5 bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-black rounded text-xs font-semibold uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Save Context
                      </button>
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
                  <SectionTitle>OpenRouter</SectionTitle>
                  <Card className="space-y-5">
                    <Row
                      title="API Key"
                      description={
                        config.openrouter?.configured
                          ? `Currently configured: ${config.openrouter.api_key}`
                          : "Required to run analysis. Get one at openrouter.ai."
                      }
                    >
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={openRouterApiKey}
                          onChange={(event) => setOpenRouterApiKey(event.target.value)}
                          placeholder="sk-or-…"
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

                    <Row
                      title="Default Model"
                      description="The OpenRouter model used for analysis."
                    >
                      <Select
                        value={config.openrouter?.default_model ?? ""}
                        options={
                          openRouterModels.length
                            ? openRouterModels.map((m) => ({
                                value: m.id,
                                label: m.name ? `${m.name}` : m.id,
                              }))
                            : [{ value: config.openrouter?.default_model ?? "", label: config.openrouter?.default_model ?? "—" }]
                        }
                        onChange={(value) =>
                          applyPatch(
                            { openrouter: { default_model: value } },
                            "Default model updated.",
                          )
                        }
                      />
                    </Row>

                    <Divider />

                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-medium">Connection Test</p>
                        {openRouterTest ? (
                          <p className="text-xs text-[#4ADE80] opacity-90 mt-1">
                            {openRouterTest.label} · {openRouterTest.is_free_tier ? "free tier" : "paid tier"}
                          </p>
                        ) : (
                          <p className="text-xs text-[#D1D1D1] opacity-70 mt-1">
                            Verifies the API key and model.
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTestOpenRouter()}
                        disabled={openRouterTesting || !config.openrouter?.configured}
                        className="px-3 py-1.5 bg-[#1C1D21] hover:bg-[#2A2C31] border border-[#2A2C31] rounded text-xs font-semibold uppercase tracking-widest text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {openRouterTesting ? (
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
