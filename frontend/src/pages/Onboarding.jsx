import { ArrowRight, Check, ChevronLeft, FolderOpen, KeyRound, Loader2, Palette, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { activateJournalFolder, loadSetupStatus, testWhisper, validateJournalFolder } from "../api/config.js";
import { useConfig } from "../hooks/useConfig.js";
import { useToast } from "../hooks/useToast.js";
import { chooseDirectory } from "../lib/desktop.js";
import { requestRecordingStream, stopMediaStream } from "../lib/media.js";
import {
  createConnection,
  getConnectionModels,
  listProviders,
  testConnectionModel,
  updateConnection,
} from "../api/providers.js";
import { TranscriptionSettingsPanel } from "../components/praxis/TranscriptionSettingsPanel.jsx";
import { RuntimeHealthRow } from "../components/praxis/RuntimeHealthRow.jsx";
import { retestDiagnostics } from "../api/diagnostics.js";
import { getTranscriptionRuntime } from "../api/transcription.js";
import { useTheme } from "../hooks/useTheme.js";
import { PraxisLogo } from "../components/praxis/PraxisLogo.jsx";
import { createPracticeGoal } from "../api/practice.js";

const DRAFT_KEY = "praxis.onboarding.draft.v1";

function loadDraft() {
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || "{}") ?? {};
  } catch {
    return {};
  }
}

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

export const ONBOARDING_STEPS = ["Privacy", "Appearance", "Journal", "Objective", "Transcription", "AI provider", "Runtime check", "Baseline"];

export function getOnboardingRepairStep(checkName) {
  const name = String(checkName || "").toLowerCase();
  if (name.includes("journal") || name.includes("disk")) return 2;
  if (name.includes("transcription") || name.includes("whisper") || name.includes("ffmpeg")) return 4;
  if (name.includes("provider") || name.includes("credential")) return 5;
  return 6;
}

function buildPersonalContext(goals, language, customObjective = "") {
  const selectedGoals = (Array.isArray(goals) ? goals : [goals])
    .map((goal) => GOAL_OPTIONS.find((option) => option.id === goal))
    .filter(Boolean);
  const resolvedGoals = selectedGoals.length ? selectedGoals : [GOAL_OPTIONS[0]];
  const selectedLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? "English";
  return [
    "The user is using Praxis as a personal video coach.",
    `Active coaching tracks: ${resolvedGoals.map((goal) => goal.label).join(", ")}.`,
    `Default practice language: ${selectedLanguage}.`,
    ...(customObjective.trim() ? [`Personal 30-day objective: ${customObjective.trim()}.`] : []),
    "Every analysis should be readable, specific, and useful for the next recording.",
    "Prefer one main lesson, one concrete practice drill, and one next-session goal over generic summary.",
  ].join("\n");
}

function OptionButton({ selected, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border p-4 text-left transition-[background-color,color,border-color,transform,box-shadow] duration-[var(--praxis-duration-control)] ease-[var(--praxis-ease-out)] active:scale-[0.97] ${
        selected
          ? "border-[var(--praxis-warning)]/70 bg-[var(--praxis-warning)]/12 shadow-[var(--praxis-shadow-warning-ring)]"
          : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] hover:border-[var(--praxis-line-strong)]"
      }`}
    >
      <div className="text-sm font-semibold text-[var(--praxis-text-primary)]">{title}</div>
      <div className="mt-2 text-xs leading-relaxed text-[var(--praxis-text-muted)]">{description}</div>
    </button>
  );
}

function ThemeChoice({ theme, selected, onSelect }) {
  return (
    <button
      type="button"
      data-theme={theme.id}
      aria-pressed={selected}
      aria-label={`Use ${theme.name} design`}
      onClick={onSelect}
      className={`group overflow-hidden rounded-[var(--praxis-radius-md)] border text-left transition-[background-color,border-color,transform,box-shadow] duration-[var(--praxis-duration-control)] ease-[var(--praxis-ease-out)] active:scale-[0.97] ${
        selected
          ? "border-[var(--praxis-accent)] ring-1 ring-[var(--praxis-accent)]"
          : "border-[var(--praxis-line-subtle)] hover:border-[var(--praxis-line-strong)]"
      }`}
    >
      <div className="h-28 bg-[var(--praxis-bg-app)] p-3 text-[var(--praxis-text-primary)]">
        <div className="flex h-full overflow-hidden rounded-[var(--praxis-radius-sm)] border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-canvas)]">
          <div className="flex w-8 flex-col items-center gap-2 border-r border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] py-2">
            <PraxisLogo size={17} />
            <span className="h-1.5 w-3 rounded-full bg-[var(--praxis-line-strong)]" />
            <span className="h-1.5 w-3 rounded-full bg-[var(--praxis-line-subtle)]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-6 items-center justify-between border-b border-[var(--praxis-line-subtle)] px-2">
              <span className="h-1.5 w-12 rounded-full bg-[var(--praxis-text-muted)]" />
              <span className="h-2 w-2 rounded-full bg-[var(--praxis-success)]" />
            </div>
            <div className="grid flex-1 grid-cols-[1.2fr_0.8fr] gap-2 p-2">
              <div className="rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-panel)] p-2">
                <div className="h-2 w-3/4 rounded-full bg-[var(--praxis-text-primary)]" />
                <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--praxis-line-strong)]" />
                <div className="mt-1 h-1.5 w-4/5 rounded-full bg-[var(--praxis-line-subtle)]" />
              </div>
              <div className="rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent-muted)] p-2">
                <div className="h-1.5 w-full rounded-full bg-[var(--praxis-accent)]" />
                <div className="mt-2 h-1.5 w-3/4 rounded-full bg-[var(--praxis-text-muted)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-start justify-between gap-3 border-t border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-3 py-3 text-[var(--praxis-text-primary)]">
        <div>
          <div className="text-sm font-semibold">{theme.name}</div>
          <div className="mt-1 text-[11px] leading-4 text-[var(--praxis-text-muted)]">{theme.description}</div>
        </div>
        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-[var(--praxis-accent)] bg-[var(--praxis-accent)] text-[var(--praxis-on-accent)]" : "border-[var(--praxis-line-strong)]"}`}>
          {selected ? <Check size={12} /> : null}
        </span>
      </div>
    </button>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-sm text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-success)]"
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

export function Onboarding({ onComplete }) {
  const draft = loadDraft();
  const { config, patchConfig, isPatching } = useConfig();
  const { pushToast } = useToast();
  const { theme, setTheme, themes } = useTheme();
  const onboardingThemes = themes.slice(0, 5);
  const [step, setStep] = useState(Math.min(Number(draft.step) || 0, 7));
  const [selectedTheme, setSelectedTheme] = useState(() => {
    const savedTheme = draft.theme ?? theme ?? "0";
    return onboardingThemes.some((item) => item.id === savedTheme) ? savedTheme : onboardingThemes[0]?.id ?? "0";
  });
  const [journalFolder, setJournalFolder] = useState(config?.journal_folder ?? draft.journalFolder ?? "");
  const [goals, setGoals] = useState(() => {
    const saved = Array.isArray(draft.goals) ? draft.goals : [draft.goal ?? "journal"];
    return saved.filter((goal) => GOAL_OPTIONS.some((option) => option.id === goal)).length
      ? saved.filter((goal) => GOAL_OPTIONS.some((option) => option.id === goal))
      : ["journal"];
  });
  const [customObjective, setCustomObjective] = useState(draft.customObjective ?? "");
  const [language, setLanguage] = useState(config?.language_default ?? draft.language ?? "en");
  const [provider, setProvider] = useState(draft.provider ?? config?.llm?.provider ?? "openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(config?.llm?.model ?? "");
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

  const [providerModels, setProviderModels] = useState([]);
  const [providerModelsLoading, setProviderModelsLoading] = useState(false);
  const [providerModelsError, setProviderModelsError] = useState("");
  const [providers, setProviders] = useState([]);
  const [connectionId, setConnectionId] = useState("");
  const [diagnosticChecks, setDiagnosticChecks] = useState([]);
  const [checkingSystem, setCheckingSystem] = useState(false);
  const [hardwareRuntime, setHardwareRuntime] = useState(null);
  const [mediaCheck, setMediaCheck] = useState("idle");

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, theme: selectedTheme, journalFolder, goals, customObjective, language, provider }));
  }, [step, selectedTheme, journalFolder, goals, customObjective, language, provider]);

  useEffect(() => {
    if (step === 4 && !hardwareRuntime) void getTranscriptionRuntime().then(setHardwareRuntime).catch(() => {});
  }, [step]);

  useEffect(() => {
    void listProviders()
      .then((items) => {
        setProviders(Array.isArray(items) ? items : []);
        if (!provider && items?.[0]?.provider_id) setProvider(items[0].provider_id);
      })
      .catch((error) => setProviderModelsError(error instanceof Error ? error.message : "Failed to load providers."));
  }, []);

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
      let activeConnectionId = connectionId;
      if (!activeConnectionId) {
        const connection = await createConnection({
          provider_id: provider,
          api_key: apiKey.trim(),
          base_url: baseUrl.trim(),
        });
        activeConnectionId = connection.id;
        setConnectionId(activeConnectionId);
        setProviderModelsLoading(true);
        const catalog = await getConnectionModels(activeConnectionId);
        const models = Array.isArray(catalog?.models) ? catalog.models : [];
        setProviderModels(models);
        setProviderModelsLoading(false);
        if (!model && models.length > 0) setModel(models[0].id);
        if (!model) {
          pushToast({ kind: "success", message: "Provider connected. Select a model to finish." });
          return;
        }
      }
      if (!model) throw new Error("Select a model returned by the provider.");
      await testConnectionModel(activeConnectionId, model);
      await updateConnection(activeConnectionId, { active: true });
      setLlmOk(true);
      pushToast({ kind: "success", message: "AI provider and model verified." });
    } catch (error) {
      setLlmOk(false);
      pushToast({
        kind: "error",
        message: error instanceof Error ? error.message : "AI provider test failed.",
      });
    } finally {
      setProviderModelsLoading(false);
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
      personal_context: buildPersonalContext(goals, language, customObjective),
      theme: selectedTheme,
      setup_completed: true,
    });
    const selectedGoals = goals.map((goalId) => GOAL_OPTIONS.find((option) => option.id === goalId)).filter(Boolean);
    const results = await Promise.allSettled(selectedGoals.map((goal) => createPracticeGoal({ text: goal.label, category: goal.id })));
    if (results.some((result) => result.status === "rejected")) {
      pushToast({ kind: "error", message: "Setup completed, but one or more selected goals could not be saved." });
    }
    window.localStorage.removeItem(DRAFT_KEY);
    pushToast({ kind: "success", message: "Praxis setup complete." });
    onComplete?.();
  }

  function toggleGoal(goalId) {
    setGoals((current) => current.includes(goalId)
      ? (current.length > 1 ? current.filter((item) => item !== goalId) : current)
      : [...current, goalId]);
  }

  async function runSystemCheck() {
    setCheckingSystem(true);
    try {
      const result = await retestDiagnostics();
      setDiagnosticChecks(Array.isArray(result?.checks) ? result.checks : Array.isArray(result) ? result : []);
    } catch (error) {
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "System check failed." });
    } finally {
      setCheckingSystem(false);
    }
  }

  async function testMediaAccess() {
    setMediaCheck("checking");
    try {
      const mediaStream = await requestRecordingStream();
      stopMediaStream(mediaStream);
      setMediaCheck("ready");
      pushToast({ kind: "success", message: "Camera and microphone are ready." });
    } catch (error) {
      setMediaCheck("failed");
      pushToast({ kind: "error", message: error instanceof Error ? error.message : "Camera or microphone check failed." });
    }
  }

  const steps = ONBOARDING_STEPS;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="h-screen overflow-hidden bg-[var(--praxis-bg-app)] text-[var(--praxis-text-primary)]">
      <div className="flex h-full">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-5 py-6 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-elevated)]">
              <PraxisLogo size={25} />
            </div>
            <div>
              <div className="text-sm font-semibold">Praxis</div>
              <div className="text-[11px] text-[var(--praxis-text-muted)]">Local setup</div>
            </div>
          </div>

          <div className="mt-10">
            <h1 className="text-xl font-semibold tracking-tight">Set up your workspace</h1>
            <p className="mt-2 text-xs leading-5 text-[var(--praxis-text-muted)]">Eight focused choices. Your recordings stay local.</p>
          </div>

          <ol className="mt-8 space-y-1" aria-label="Setup progress">
            {steps.map((label, index) => {
              const current = step === index;
              const complete = step > index;
              return (
                <li key={label} aria-current={current ? "step" : undefined} className={`flex h-9 items-center gap-3 rounded-[var(--praxis-radius-sm)] px-2.5 text-xs ${current ? "bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]" : complete ? "text-[var(--praxis-text-secondary)]" : "text-[var(--praxis-text-muted)]"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border font-mono text-[9px] ${complete ? "border-[var(--praxis-success)] bg-[var(--praxis-success-soft)] text-[var(--praxis-success)]" : current ? "border-[var(--praxis-accent)] text-[var(--praxis-accent)]" : "border-[var(--praxis-line-strong)]"}`}>
                    {complete ? <Check size={11} /> : index + 1}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          <div className="mt-auto border-t border-[var(--praxis-line-subtle)] pt-4">
            <div className="flex items-center gap-2 text-xs text-[var(--praxis-text-secondary)]"><ShieldCheck size={14} className="text-[var(--praxis-success)]" /> No account required</div>
            <div className="mt-2 flex items-center gap-2 text-xs text-[var(--praxis-text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--praxis-success)]" /> Stored on this device</div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-5 py-4 sm:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-bg-elevated)] lg:hidden"><PraxisLogo size={22} /></div>
                <div className="min-w-0">
                  <div className="text-xs text-[var(--praxis-text-muted)]">Step {step + 1} of {steps.length}</div>
                  <div className="truncate text-sm font-medium">{steps[step]}</div>
                </div>
              </div>
              <div className="w-36 sm:w-56" aria-label={`${Math.round(progress)} percent complete`} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(progress)}>
                <div className="mb-1.5 flex justify-between text-[10px] text-[var(--praxis-text-muted)]"><span>Setup</span><span>{Math.round(progress)}%</span></div>
                <div className="h-1 overflow-hidden rounded-full bg-[var(--praxis-line-subtle)]"><div className="h-full origin-left rounded-full bg-[var(--praxis-accent)] transition-transform duration-[var(--praxis-duration-pane)] ease-[var(--praxis-ease-out)]" style={{ transform: `scaleX(${progress / 100})` }} /></div>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-5xl items-center px-5 py-8 sm:px-8 lg:py-12">
              <section className="w-full">
              <div className="mb-6 text-xs text-[var(--praxis-text-muted)]">{steps[step]}</div>
              <div key={step} className="praxis-crossfade">
              {step === 0 ? (
                <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
                  <div>
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[var(--praxis-success-soft)] px-3 py-1.5 text-xs font-medium text-[var(--praxis-success)]"><ShieldCheck size={14} /> Private by design</div>
                    <h2 className="max-w-[18ch] text-4xl font-semibold tracking-[-0.035em] text-[var(--praxis-text-primary)]">Build a speaking practice you can actually repeat.</h2>
                    <p className="mt-5 max-w-[58ch] text-[15px] leading-7 text-[var(--praxis-text-secondary)]">Praxis turns each recording into one evidence-backed correction, one drill, and one measurable goal for the next session.</p>
                  </div>
                  <div className="divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">
                    {[
                      ["Recordings stay local", "Video, audio, transcripts, and reports remain in your journal folder."],
                      ["Transcription runs here", "Whisper processes your recording without uploading the media."],
                      ["You choose the AI", "Only the text needed for coaching is sent to your configured provider."],
                    ].map(([title, description]) => (
                      <div key={title} className="flex gap-4 py-4">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--praxis-success-soft)] text-[var(--praxis-success)]"><Check size={13} /></span>
                        <div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs leading-5 text-[var(--praxis-text-muted)]">{description}</p></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div>
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent-muted)] text-[var(--praxis-accent)]"><Palette size={19} /></div>
                    <div>
                      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[var(--praxis-text-primary)]">Choose how Praxis should feel.</h2>
                      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-[var(--praxis-text-secondary)]">Pick one of the five interface designs. The whole wizard changes immediately, and you can switch again later in Settings.</p>
                    </div>
                  </div>

                  <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {onboardingThemes.map((item) => (
                      <ThemeChoice
                        key={item.id}
                        theme={item}
                        selected={selectedTheme === item.id}
                        onSelect={() => {
                          setSelectedTheme(item.id);
                          setTheme(item.id);
                        }}
                      />
                    ))}
                  </div>

                  <div className="mt-5 flex items-center gap-2 text-xs text-[var(--praxis-text-muted)]">
                    <Check size={14} className="text-[var(--praxis-success)]" />
                    Selected: <span className="font-medium text-[var(--praxis-text-primary)]">{onboardingThemes.find((item) => item.id === selectedTheme)?.name || onboardingThemes[0]?.name}</span>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--praxis-text-primary)]">Create your journal vault.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--praxis-text-muted)]">
                      Praxis stores videos, transcripts, reports, subtitles, and stats in one folder you control.
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                      Journal folder
                    </div>
                    <div className="mt-2 break-all text-sm text-[var(--praxis-text-primary)]">{journalFolder || "No folder selected"}</div>
                    <button
                      type="button"
                      onClick={() => void pickFolder()}
                      disabled={validatingFolder}
                      className="mt-4 inline-flex items-center gap-2 rounded bg-[var(--praxis-line-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors hover:bg-[var(--praxis-hover)] disabled:opacity-50"
                    >
                      {validatingFolder ? <Loader2 size={14} className="animate-spin" /> : <FolderOpen size={14} />}
                      Choose Folder
                    </button>
                    {journalStatus ? (
                      <div className="mt-4 grid grid-cols-1 gap-2 text-[11px] font-mono text-[var(--praxis-text-muted)] sm:grid-cols-3">
                        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2">
                          {journalStatus.writable ? "Writable" : "Not writable"}
                        </div>
                        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2">
                          {journalStatus.session_count ?? 0} sessions
                        </div>
                        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2">
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
                        className="mt-4 inline-flex items-center gap-2 rounded border border-[var(--praxis-success)]/35 bg-[var(--praxis-success)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--praxis-success)] transition-colors hover:bg-[var(--praxis-success)]/15 disabled:opacity-50"
                      >
                        {activatingFolder ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        {journalActivated ? "Journal Active" : "Use This Journal"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--praxis-text-primary)]">What should Praxis coach?</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--praxis-text-muted)]">
                      Choose every track you want to work on. Praxis keeps them active together instead of making you choose only one.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {GOAL_OPTIONS.map((option) => (
                      <OptionButton
                        key={option.id}
                        selected={goals.includes(option.id)}
                        title={option.label}
                        description={option.text}
                        onClick={() => toggleGoal(option.id)}
                      />
                    ))}
                  </div>
                  <SelectField
                    label="Default practice language"
                    value={language}
                    options={LANGUAGE_OPTIONS}
                    onChange={setLanguage}
                  />
                  <label className="block"><span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">Your 30-day objective</span><textarea value={customObjective} onChange={(event) => setCustomObjective(event.target.value.slice(0, 500))} placeholder="For example: explain my ideas clearly without circling around the point." className="mt-2 min-h-24 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] p-3 text-sm leading-6 text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-accent)]"/></label>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-6"><div><h2 className="text-3xl font-semibold tracking-tight text-[var(--praxis-text-primary)]">Choose the right local model.</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--praxis-text-muted)]">Praxis inspected this computer so the first transcription model is fast enough without exhausting memory.</p></div>{hardwareRuntime?.hardware ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["CPU", `${hardwareRuntime.hardware.logical_cores} threads`], ["Memory", `${hardwareRuntime.hardware.total_ram_gb} GB`], ["Disk", `${hardwareRuntime.hardware.free_disk_gb} GB free`], ["Acceleration", hardwareRuntime.hardware.cuda_available ? "CUDA" : "CPU"]].map(([label, value]) => <div key={label} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4"><div className="text-[10px] uppercase tracking-widest text-[var(--praxis-text-muted)]">{label}</div><div className="mt-2 text-sm text-[var(--praxis-text-primary)]">{value}</div></div>)}</div> : <div className="flex items-center gap-2 text-sm text-[var(--praxis-text-secondary)]"><Loader2 size={14} className="animate-spin"/> Inspecting hardware…</div>}{hardwareRuntime?.recommendation ? <div className="rounded border border-[var(--praxis-accent)]/30 bg-[var(--praxis-accent)]/10 p-4"><div className="text-sm font-medium text-[var(--praxis-text-primary)]">Recommended: {hardwareRuntime.recommendation.recommended_model}</div><p className="mt-2 text-xs leading-5 text-[var(--praxis-text-secondary)]">{hardwareRuntime.recommendation.reason}</p></div> : null}</div>
              ) : null}

              {step === 5 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--praxis-text-primary)]">Connect analysis AI.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--praxis-text-muted)]">
                      This powers the coach report, lessons, practice assignment, and language rewrites.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {providers.map((option) => (
                      <OptionButton
                        key={option.provider_id}
                        selected={provider === option.provider_id}
                        title={option.display_name}
                        description={option.requires_base_url ? "Connect a compatible endpoint." : "Fetch models from this provider."}
                        onClick={() => {
                          setProvider(option.provider_id);
                          setModel("");
                          setConnectionId("");
                          setProviderModels([]);
                          setLlmOk(false);
                        }}
                      />
                    ))}
                  </div>

                  {providerModelsLoading ? <div className="text-sm text-[var(--praxis-text-muted)]">Fetching available models…</div> : null}
                  {providerModels.length ? (
                    <SelectField
                      label="Available model"
                      value={model}
                      options={providerModels.map((item) => ({ value: item.id, label: item.display_name || item.id }))}
                      onChange={(value) => { setModel(value); setLlmOk(false); }}
                    />
                  ) : null}
                  {providerModelsError ? <div className="text-xs text-[var(--praxis-danger)]">{providerModelsError}</div> : null}

                  {provider === "openai_compatible" || provider === "litellm_proxy" ? (
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                        Base URL
                      </span>
                      <input
                        value={baseUrl}
                        onChange={(event) => setBaseUrl(event.target.value)}
                        className="mt-2 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-sm text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-success)]"
                        placeholder="https://.../v1"
                      />
                    </label>
                  ) : null}

                  {provider !== "litellm_proxy" ? (
                    <label className="block">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                        API key
                      </span>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        className="mt-2 w-full rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-sm text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-success)]"
                        placeholder={provider === "openrouter" ? "sk-or-..." : "API key"}
                      />
                    </label>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void saveAiAndTest()}
                    disabled={testingLlm || isPatching || !provider || (!connectionId && provider !== "ollama" && provider !== "lm_studio" && !apiKey.trim())}
                    className="inline-flex items-center gap-2 rounded bg-[var(--praxis-line-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] transition-colors hover:bg-[var(--praxis-hover)] disabled:opacity-50"
                  >
                    {testingLlm ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {connectionId && model ? "Verify Model" : "Connect and Fetch Models"}
                  </button>
                </div>
              ) : null}

              {step === 4 ? (
                <TranscriptionSettingsPanel activeModel={config?.whisper?.model} pushToast={pushToast} />
              ) : null}

              {step === 6 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--praxis-text-primary)]">Check the local runtime.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--praxis-text-muted)]">
                      Verify storage, media tools, transcription, and the local service before your first recording.
                    </p>
                  </div>
                  <RuntimeHealthRow checks={diagnosticChecks} onRetest={() => void runSystemCheck()} onAction={(check) => {
                    setStep(getOnboardingRepairStep(check.name));
                  }} />
                  <div className="flex items-center justify-between gap-4 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-4 py-3"><div><div className="text-sm text-[var(--praxis-text-primary)]">Camera and microphone</div><p className="mt-1 text-xs text-[var(--praxis-text-muted)]">Permission is requested only for this local device check.</p></div><button type="button" onClick={() => void testMediaAccess()} disabled={mediaCheck === "checking"} className={`rounded px-3 py-2 text-xs font-medium ${mediaCheck === "ready" ? "bg-[var(--praxis-success-soft)] text-[var(--praxis-success)]" : mediaCheck === "failed" ? "bg-[var(--praxis-record)]/15 text-[var(--praxis-record)]" : "border border-[var(--praxis-line-subtle)] text-[var(--praxis-text-primary)]"}`}>{mediaCheck === "checking" ? "Checking…" : mediaCheck === "ready" ? "Ready" : mediaCheck === "failed" ? "Retry" : "Test access"}</button></div>
                  {!diagnosticChecks.length ? (
                    <button type="button" onClick={() => void runSystemCheck()} disabled={checkingSystem}
                      className="inline-flex items-center gap-2 rounded bg-[var(--praxis-line-subtle)] px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)] disabled:opacity-50">
                      {checkingSystem ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Run system check
                    </button>
                  ) : null}
                </div>
              ) : null}

              {step === 7 ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-[var(--praxis-text-primary)]">Create your two-minute baseline.</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--praxis-text-muted)]">
                      Talk about your 30-day objective, what is difficult today, and what “better” would sound like. This first journal creates your baseline and first practice goal.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">Goal</div>
                      <div className="mt-2 text-sm text-[var(--praxis-text-primary)]">
                        {goals.map((goalId) => GOAL_OPTIONS.find((option) => option.id === goalId)?.label).filter(Boolean).join(" + ")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">Language</div>
                      <div className="mt-2 text-sm text-[var(--praxis-text-primary)]">
                        {LANGUAGE_OPTIONS.find((option) => option.value === language)?.label}
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">AI</div>
                      <div className="mt-2 text-sm text-[var(--praxis-text-primary)]">{provider} · {model}</div>
                    </div>
                    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">Whisper</div>
                      <div className="mt-2 text-sm text-[var(--praxis-text-primary)]">{config?.whisper?.model || whisperModel}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void finishSetup()}
                    disabled={isPatching}
                    className="inline-flex items-center gap-2 rounded bg-[var(--praxis-warning)] px-5 py-3 text-xs font-bold uppercase tracking-widest text-[var(--praxis-on-warning)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isPatching ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Start baseline journal
                  </button>
                </div>
              ) : null}
              </div>
            </section>
            </div>
        </main>

          <footer className="shrink-0 border-t border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-5 py-4 sm:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <button
                type="button"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
                className="inline-flex h-9 items-center gap-2 rounded-[var(--praxis-radius-sm)] px-3 text-xs font-medium text-[var(--praxis-text-secondary)] transition-colors hover:bg-[var(--praxis-bg-hover)] hover:text-[var(--praxis-text-primary)] disabled:opacity-0"
              >
                <ChevronLeft size={15} /> Back
              </button>
              {step < 7 ? (
                <button
                  type="button"
                  disabled={(step === 2 && !journalFolder) || validatingFolder || activatingFolder}
                  onClick={async () => {
                    if (step === 2 && !journalActivated) {
                      const activated = await activateFolder();
                      if (!activated) return;
                    }
                    if (step === 5) void refreshSetupStatus();
                    if (step === 5 && !diagnosticChecks.length) void runSystemCheck();
                    setStep((current) => Math.min(7, current + 1));
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-[var(--praxis-radius-sm)] bg-[var(--praxis-accent)] px-4 text-xs font-semibold text-[var(--praxis-on-accent)] transition-[background-color,transform] duration-[var(--praxis-duration-control)] ease-[var(--praxis-ease-out)] hover:brightness-110 disabled:opacity-40"
                >
                  {step === 0 ? "Begin setup" : step === 1 ? "Use this design" : "Continue"}
                  <ArrowRight size={15} />
                </button>
              ) : <span />}
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
