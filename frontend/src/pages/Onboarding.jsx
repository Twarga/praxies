import { Check, FolderOpen, KeyRound, Loader2, Mic2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import {
  activateJournalFolder,
  loadSetupStatus,
  testLlm,
  testWhisper,
  validateJournalFolder,
} from "../api/config.js";
import { useConfig } from "../hooks/useConfig.js";
import { useToast } from "../hooks/useToast.js";
import { chooseDirectory } from "../lib/desktop.js";

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

const GOAL_OPTIONS = [
  {
    id: "journal",
    label: "Journal Better",
    text: "Turn daily reflection into one lesson and one concrete next action.",
  },
  {
    id: "language",
    label: "Practice Language",
    text: "Improve fluency, sentence quality, vocabulary, and speaking confidence.",
  },
  {
    id: "clarity",
    label: "Speak Clearly",
    text: "Make your thinking more specific, structured, and easier to explain.",
  },
  {
    id: "present",
    label: "Presentation Practice",
    text: "Practice stronger openings, cleaner arguments, and better delivery.",
  },
];

const PROVIDERS = [
  { value: "openrouter", label: "OpenRouter", hint: "Flexible model catalog." },
  { value: "opencode_go", label: "OpenCode Go", hint: "Use your OpenCode subscription endpoint." },
  { value: "openai_compatible", label: "OpenAI-compatible", hint: "Any /v1 compatible API." },
  { value: "litellm_proxy", label: "LiteLLM proxy", hint: "Local or remote LiteLLM gateway." },
];

const OPENCODE_GO_MODELS = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "glm-5.1",
  "qwen3.6-plus",
  "kimi-k2.6",
];

const WHISPER_MODELS = [
  { value: "large-v3-turbo", label: "large-v3-turbo", hint: "Recommended balance." },
  { value: "medium", label: "medium", hint: "Smaller and faster to download." },
  { value: "small", label: "small", hint: "Lightweight first test." },
];

function buildPersonalContext(goal, language) {
  const selectedGoal = GOAL_OPTIONS.find((option) => option.id === goal) ?? GOAL_OPTIONS[0];
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? "English";
  return [
    "The user is using Praxis as a personal video coach.",
    `Primary goal: ${selectedGoal.label}.`,
    `Default practice language: ${selectedLanguage}.`,
    "Every analysis should be readable, specific, and useful for the next recording.",
    "Prefer one main lesson, one concrete practice drill, and one next-session goal over generic summary.",
  ].join("\n");
}

function StepPill({ active, done, children }) {
  return (
    <div
      className={`rounded-full border px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition-colors ${
        active
          ? "border-[#F27D26]/60 bg-[#F27D26]/15 text-[#F27D26]"
          : done
            ? "border-[#4ADE80]/50 bg-[#4ADE80]/10 text-[#4ADE80]"
            : "border-[#2A2C31] bg-[#151619] text-[#D1D1D1]/45"
      }`}
    >
      {children}
    </div>
  );
}

function OptionButton({ selected, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-all ${
        selected
          ? "border-[#F27D26]/70 bg-[#F27D26]/12 shadow-[0_0_0_1px_rgba(242,125,38,0.25)]"
          : "border-[#2A2C31] bg-[#151619] hover:border-[#454852]"
      }`}
    >
      <div className="text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-xs leading-relaxed text-[#D1D1D1]/65">{description}</div>
    </button>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2 text-sm text-white outline-none focus:border-[#4ADE80]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Onboarding() {
  const { config, patchConfig, isPatching } = useConfig();
  const { pushToast } = useToast();
  const [step, setStep] = useState(0);
  const [journalFolder, setJournalFolder] = useState(config?.journal_folder ?? "");
  const [goal, setGoal] = useState("journal");
  const [language, setLanguage] = useState(config?.language_default ?? "en");
  const [provider, setProvider] = useState(config?.llm?.provider ?? "openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(config?.llm?.model ?? "google/gemini-2.5-flash-lite");
  const [baseUrl, setBaseUrl] = useState(config?.llm?.base_url ?? "");
  const [whisperModel, setWhisperModel] = useState(config?.whisper?.model ?? "large-v3-turbo");
  const [testingLlm, setTestingLlm] = useState(false);
  const [testingWhisper, setTestingWhisper] = useState(false);
  const [validatingFolder, setValidatingFolder] = useState(false);
  const [activatingFolder, setActivatingFolder] = useState(false);
  const [llmOk, setLlmOk] = useState(false);
  const [whisperOk, setWhisperOk] = useState(false);
  const [journalStatus, setJournalStatus] = useState(null);
  const [journalActivated, setJournalActivated] = useState(false);
  const [setupStatus, setSetupStatus] = useState(null);

  const modelOptions = useMemo(() => {
    if (provider === "opencode_go") {
      return OPENCODE_GO_MODELS.map((value) => ({ value, label: value }));
    }
    if (provider === "openrouter") {
      return [
        { value: "google/gemini-2.5-flash-lite", label: "google/gemini-2.5-flash-lite" },
        { value: "anthropic/claude-sonnet-4.5", label: "anthropic/claude-sonnet-4.5" },
        { value: "openai/gpt-5.1-mini", label: "openai/gpt-5.1-mini" },
      ];
    }
    return [];
  }, [provider]);

  async function pickFolder() {
    const folder = await chooseDirectory();
    if (folder) {
      setJournalFolder(folder);
      setJournalActivated(false);
      await validateFolder(folder);
    }
  }

  async function validateFolder(folder = journalFolder) {
    if (!folder) return;
    setValidatingFolder(true);
    try {
      const status = await validateJournalFolder(folder);
      setJournalStatus(status);
      setJournalActivated(false);
      if (!status.ok) {
        pushToast({ kind: "error", message: status.error || "Journal folder is not writable." });
      }
    } catch (error) {
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Journal folder validation failed.",
      });
    } finally {
      setValidatingFolder(false);
    }
  }

  async function activateFolder() {
    if (!journalFolder) return false;
    setActivatingFolder(true);
    try {
      const result = await activateJournalFolder(journalFolder);
      setJournalStatus(result.journal);
      setJournalActivated(true);
      pushToast({
        kind: "success",
        message: `Journal ready. ${result.index?.sessions?.length ?? 0} sessions indexed.`,
      });
      return true;
    } catch (error) {
      setJournalActivated(false);
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Failed to activate journal folder.",
      });
      return false;
    } finally {
      setActivatingFolder(false);
    }
  }

  async function refreshSetupStatus() {
    try {
      const status = await loadSetupStatus();
      setSetupStatus(status);
      setWhisperOk(Boolean(status?.whisper?.model_likely_cached));
    } catch {
      setSetupStatus(null);
    }
  }

  async function saveAiAndTest() {
    setTestingLlm(true);
    try {
      await patchConfig({
        llm: {
          provider,
          api_key: apiKey.trim(),
          model,
          base_url: baseUrl.trim(),
        },
      });
      await testLlm();
      setLlmOk(true);
      pushToast({ kind: "success", message: "AI provider connected." });
    } catch (error) {
      setLlmOk(false);
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "AI provider test failed.",
      });
    } finally {
      setTestingLlm(false);
    }
  }

  async function saveWhisperAndTest() {
    setTestingWhisper(true);
    try {
      await patchConfig({ whisper: { model: whisperModel, compute_type: "int8", device: "cpu" } });
      await testWhisper();
      await refreshSetupStatus();
      setWhisperOk(true);
      pushToast({ kind: "success", message: "Local transcription is ready." });
    } catch (error) {
      setWhisperOk(false);
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "Whisper test failed.",
      });
    } finally {
      setTestingWhisper(false);
    }
  }

  async function finishSetup() {
    await patchConfig({
      journal_folder: journalFolder,
      language_default: language,
      personal_context: buildPersonalContext(goal, language),
      llm: {
        provider,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        model,
        base_url: baseUrl.trim(),
      },
      whisper: { model: whisperModel, compute_type: "int8", device: "cpu" },
      setup_completed: true,
    });
    pushToast({ kind: "success", message: "Praxis setup complete." });
  }

  const steps = ["Vault", "Goal", "AI", "Transcription", "Ready"];

  return (
    <div className="min-h-screen overflow-y-auto bg-[#0A0B0D] text-[#E0E0E0]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#F27D26]/40 bg-[#F27D26]/15 text-[#F27D26]">
                <Sparkles size={18} />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">Praxis</h1>
                <p className="text-xs font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                  first-run setup
                </p>
              </div>
            </div>
          </div>
          <div className="hidden flex-wrap gap-2 md:flex">
            {steps.map((label, index) => (
              <StepPill key={label} active={step === index} done={step > index}>
                {label}
              </StepPill>
            ))}
          </div>
        </header>

        <main className="flex flex-1 items-center py-10">
          <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-[#2A2C31] bg-[#101114] p-6 shadow-2xl shadow-black/30">
              {step === 0 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-white">Create your journal vault.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#D1D1D1]/75">
                      Praxis stores videos, transcripts, reports, subtitles, and stats in one folder you control.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                      Journal folder
                    </div>
                    <div className="mt-2 break-all text-sm text-white">{journalFolder || "No folder selected"}</div>
                    <button
                      type="button"
                      onClick={() => void pickFolder()}
                      disabled={validatingFolder}
                      className="mt-4 inline-flex items-center gap-2 rounded bg-[#2A2C31] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#32353B] disabled:opacity-50"
                    >
                      {validatingFolder ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                      Choose Folder
                    </button>
                    {journalStatus ? (
                      <div className="mt-4 grid grid-cols-1 gap-2 text-[11px] font-mono text-[#D1D1D1]/65 sm:grid-cols-3">
                        <div className="rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2">
                          {journalStatus.writable ? "Writable" : "Not writable"}
                        </div>
                        <div className="rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2">
                          {journalStatus.session_count ?? 0} sessions
                        </div>
                        <div className="rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2">
                          {journalActivated
                            ? "Index rebuilt"
                            : journalStatus.index_exists
                              ? "Index found"
                              : "Index will be created"}
                        </div>
                      </div>
                    ) : null}
                    {journalStatus?.ok ? (
                      <button
                        type="button"
                        onClick={() => void activateFolder()}
                        disabled={activatingFolder || journalActivated}
                        className="mt-4 inline-flex items-center gap-2 rounded border border-[#4ADE80]/35 bg-[#4ADE80]/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#4ADE80] transition-colors hover:bg-[#4ADE80]/15 disabled:opacity-50"
                      >
                        {activatingFolder ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {journalActivated ? "Journal Active" : "Use This Journal"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-white">What should Praxis coach?</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#D1D1D1]/75">
                      This shapes the default prompt so reports teach instead of only summarizing.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {GOAL_OPTIONS.map((option) => (
                      <OptionButton
                        key={option.id}
                        selected={goal === option.id}
                        title={option.label}
                        description={option.text}
                        onClick={() => setGoal(option.id)}
                      />
                    ))}
                  </div>
                  <SelectField
                    label="Default practice language"
                    value={language}
                    options={LANGUAGE_OPTIONS}
                    onChange={setLanguage}
                  />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-white">Connect analysis AI.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#D1D1D1]/75">
                      This powers the coach report, lessons, practice assignment, and language rewrites.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {PROVIDERS.map((option) => (
                      <OptionButton
                        key={option.value}
                        selected={provider === option.value}
                        title={option.label}
                        description={option.hint}
                        onClick={() => {
                          setProvider(option.value);
                          if (option.value === "opencode_go") setModel("deepseek-v4-flash");
                          if (option.value === "openrouter") setModel("google/gemini-2.5-flash-lite");
                        }}
                      />
                    ))}
                  </div>

                  {modelOptions.length ? (
                    <SelectField label="Model" value={model} options={modelOptions} onChange={setModel} />
                  ) : (
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                        Model
                      </span>
                      <input
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        className="mt-2 w-full rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2 text-sm text-white outline-none focus:border-[#4ADE80]"
                        placeholder="model id"
                      />
                    </label>
                  )}

                  {provider === "openai_compatible" || provider === "litellm_proxy" ? (
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                        Base URL
                      </span>
                      <input
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        className="mt-2 w-full rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2 text-sm text-white outline-none focus:border-[#4ADE80]"
                        placeholder="https://.../v1"
                      />
                    </label>
                  ) : null}

                  {provider !== "litellm_proxy" ? (
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                        API key
                      </span>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        className="mt-2 w-full rounded border border-[#2A2C31] bg-[#0A0B0D] px-3 py-2 text-sm text-white outline-none focus:border-[#4ADE80]"
                        placeholder={provider === "openrouter" ? "sk-or-..." : "API key"}
                      />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void saveAiAndTest()}
                    disabled={testingLlm || isPatching || (provider !== "litellm_proxy" && !apiKey.trim())}
                    className="inline-flex items-center gap-2 rounded bg-[#2A2C31] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#32353B] disabled:opacity-50"
                  >
                    {testingLlm ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    Test AI
                  </button>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-white">Prepare local transcription.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#D1D1D1]/75">
                      Whisper runs locally. The first model load may download files into your cache.
                    </p>
                  </div>
                  {setupStatus?.whisper ? (
                    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                        Cache
                      </div>
                      <div className="mt-2 break-all text-xs text-[#D1D1D1]/70">
                        {setupStatus.whisper.cache_dir}
                      </div>
                      <div className="mt-3 text-sm text-white">
                        {setupStatus.whisper.model_likely_cached
                          ? `${setupStatus.whisper.model} appears cached.`
                          : `${setupStatus.whisper.model} is not cached yet.`}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {WHISPER_MODELS.map((option) => (
                      <OptionButton
                        key={option.value}
                        selected={whisperModel === option.value}
                        title={option.label}
                        description={option.hint}
                        onClick={() => setWhisperModel(option.value)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveWhisperAndTest()}
                    disabled={testingWhisper || isPatching}
                    className="inline-flex items-center gap-2 rounded bg-[#2A2C31] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition-colors hover:bg-[#32353B] disabled:opacity-50"
                  >
                    {testingWhisper ? <Loader2 size={14} className="animate-spin" /> : <Mic2 size={14} />}
                    Test Whisper
                  </button>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-white">Ready to record.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#D1D1D1]/75">
                      Your journal vault, coaching goal, AI provider, and transcription settings are saved.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">Goal</div>
                      <div className="mt-2 text-sm text-white">
                        {GOAL_OPTIONS.find((option) => option.id === goal)?.label}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">Language</div>
                      <div className="mt-2 text-sm text-white">
                        {LANGUAGE_OPTIONS.find((option) => option.value === language)?.label}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">AI</div>
                      <div className="mt-2 text-sm text-white">{provider} · {model}</div>
                    </div>
                    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">Whisper</div>
                      <div className="mt-2 text-sm text-white">{whisperModel}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void finishSetup()}
                    disabled={isPatching}
                    className="inline-flex items-center gap-2 rounded bg-[#F27D26] px-5 py-3 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#f59b56] disabled:opacity-50"
                  >
                    {isPatching ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Enter Praxis
                  </button>
                </div>
              ) : null}
            </section>

            <aside className="rounded-lg border border-[#2A2C31] bg-[#151619] p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/45">
                Setup Summary
              </div>
              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <div className="text-[#D1D1D1]/45">Vault</div>
                  <div className="mt-1 break-all text-white">{journalFolder || "Not selected"}</div>
                </div>
                <div>
                  <div className="text-[#D1D1D1]/45">AI status</div>
                  <div className={llmOk ? "mt-1 text-[#4ADE80]" : "mt-1 text-[#D1D1D1]/65"}>
                    {llmOk ? "Connected" : "Not tested"}
                  </div>
                </div>
                <div>
                  <div className="text-[#D1D1D1]/45">Whisper status</div>
                  <div className={whisperOk ? "mt-1 text-[#4ADE80]" : "mt-1 text-[#D1D1D1]/65"}>
                    {whisperOk ? "Ready" : "Not tested"}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>

        <footer className="flex items-center justify-between border-t border-[#2A2C31] py-5">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            className="rounded border border-[#2A2C31] bg-[#151619] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#D1D1D1] transition-colors hover:text-white disabled:opacity-40"
          >
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={(step === 0 && !journalFolder) || validatingFolder || activatingFolder}
              onClick={async () => {
                if (step === 0 && !journalActivated) {
                  const activated = await activateFolder();
                  if (!activated) return;
                }
                if (step === 2) void refreshSetupStatus();
                setStep((current) => Math.min(4, current + 1));
              }}
              className="rounded bg-[#E0E0E0] px-5 py-2 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white disabled:opacity-40"
            >
              Continue
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
