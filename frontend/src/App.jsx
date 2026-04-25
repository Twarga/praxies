import { useEffect, useRef, useState } from "react";
import { deleteSession, finalizeSession } from "./api/sessions.js";
import { useConfig } from "./hooks/useConfig.js";
import { useIndex } from "./hooks/useIndex.js";
import { useRecorder } from "./hooks/useRecorder.js";
import { chooseDirectory, openDesktopPath } from "./lib/desktop.js";
import {
  filterGallerySessions,
  groupGallerySessionsByMonth,
  getGalleryLanguageFilters,
  getGalleryLanguageLabel,
} from "./lib/gallery.js";
import {
  getRecordingPermissionMessage,
  isPermissionDeniedError,
  requestRecordingStream,
  stopMediaStream,
} from "./lib/media.js";
import { createBeforeUnloadHandler } from "./lib/recording.js";
import {
  createPageRoute,
  createSessionRoute,
  getActiveNavKey,
  isRecordRoute,
} from "./lib/routes.js";
import { getRecordShortcutAction } from "./lib/recordShortcuts.js";
import {
  formatBooleanToggle,
  formatLanguageValue,
  formatRetentionValue,
  LANGUAGE_OPTIONS,
  RETENTION_OPTIONS,
  VIDEO_QUALITY_OPTIONS,
  WHISPER_MODEL_OPTIONS,
} from "./lib/settings.js";

const navItems = ["today", "gallery", "trends", "settings"];
const ACTIVE_RECORDER_STATES = new Set(["recording", "paused", "stopping"]);

function formatRecordingTimer(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatRecordingDurationLabel(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);

  if (minutes >= 1) {
    return `${minutes} min`;
  }

  return `${safeSeconds}s`;
}

function formatRecordingFileSize(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 mb";
  }

  const megabytes = Math.max(1, Math.round(bytes / (1024 * 1024)));
  return `${megabytes} mb`;
}

function LeftRail({ activePage, onNavigate }) {
  const { index, isLoading } = useIndex();
  const currentStreak = index?.streak?.current ?? 0;
  const totalSessions = index?.totals?.sessions ?? 0;

  return (
    <aside className="rail">
      <div className="rail-brand">
        <div className="wordmark">TWARGA</div>
        <div className="wordmark-sub">journal</div>
      </div>

      <nav className="nav-list" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item}
            type="button"
            className={`nav-item ${activePage === item ? "active" : ""}`}
            aria-current={activePage === item ? "page" : undefined}
            onClick={() => onNavigate(item)}
          >
            <span className="nav-dot" aria-hidden="true" />
            <span className="nav-label">{item}</span>
          </button>
        ))}
      </nav>

      <div className="rail-divider" />

      <div className="record-slot" aria-label="Record slot">
        <button type="button" className="record-button" onClick={() => onNavigate("record")}>
          <span className="record-dot" aria-hidden="true" />
          <span>record</span>
        </button>
      </div>

      <div className="rail-spacer" />

      <div className="rail-stats">
        <div>
          streak&nbsp;&nbsp;
          {isLoading ? "—" : `${currentStreak}d`}
        </div>
        <div>
          total&nbsp;&nbsp;
          {isLoading ? "—" : totalSessions}
        </div>
      </div>
    </aside>
  );
}

function TodayPage() {
  const { index, isLoading } = useIndex();
  const hasSessions = (index?.sessions?.length ?? 0) > 0;

  return (
    <main className="main">
      <div className="date-line">thursday · 24 april 2026</div>
      <div className="status-line">you haven&apos;t recorded today yet.</div>

      {(!hasSessions || isLoading) && (
        <section className="welcome-block" aria-label="Welcome">
          <p>welcome back.</p>
          <p>
            no sessions yet. when you&apos;re ready, click record on the left to start your first
            one.
          </p>
          <p>
            one more thing — set your openrouter key in settings if you want ai analysis. you can
            skip it and just record.
          </p>
        </section>
      )}
    </main>
  );
}

function GalleryPage() {
  const { index, isLoading } = useIndex();
  const [languageFilter, setLanguageFilter] = useState("all");
  const sessions = index?.sessions ?? [];
  const filteredSessions = filterGallerySessions(sessions, languageFilter);
  const monthGroups = groupGallerySessionsByMonth(filteredSessions);

  return (
    <main className="main gallery-page">
      <div className="gallery-topbar">
        <h1 className="page-title">gallery</h1>
        <div className="gallery-filter-row" aria-label="Gallery language filter">
          {getGalleryLanguageFilters().map((language, index) => (
            <div key={language} className="gallery-filter-group">
              {index > 0 ? <span className="gallery-filter-separator">·</span> : null}
              <button
                type="button"
                className={`gallery-filter-button ${languageFilter === language ? "active" : ""}`}
                onClick={() => setLanguageFilter(language)}
              >
                {getGalleryLanguageLabel(language)}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-note">
        {isLoading
          ? "loading sessions…"
          : `${filteredSessions.length} session${filteredSessions.length === 1 ? "" : "s"} in view.`}
      </div>

      {monthGroups.map((group) => (
        <section key={group.label} className="gallery-month-section">
          <div className="gallery-month-label">{group.label}</div>
          <div className="settings-note">
            {group.sessions.length} session{group.sessions.length === 1 ? "" : "s"} in this month.
          </div>
        </section>
      ))}
    </main>
  );
}

function TrendsPage() {
  return (
    <main className="main">
      <h1 className="page-title">trends</h1>
      <div className="settings-note">trends route ready. charts come later.</div>
    </main>
  );
}

function SessionDetailPlaceholder({ sessionId, onBack }) {
  return (
    <main className="main">
      <button type="button" className="record-back" onClick={onBack}>
        ← gallery
      </button>
      <h1 className="page-title">session</h1>
      <div className="settings-note">{sessionId}</div>
    </main>
  );
}

function SettingsRow({ label, value = "—", action = "change" }) {
  return (
    <div className="settings-row">
      <div className="settings-label">{label}</div>
      <div className="settings-value">{value}</div>
      <div className="settings-action-slot">
        {action ? (
          <button type="button" className="settings-action">
            {action}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DisabledSettingsRow({ label, value = "—" }) {
  return (
    <div className="settings-row settings-row-disabled" aria-disabled="true">
      <div className="settings-label">{label}</div>
      <div className="settings-value">{value}</div>
      <div className="settings-action-slot" />
    </div>
  );
}

function ActionSettingsRow({ action = "open", label, onAction, value = "—" }) {
  return (
    <div className="settings-row">
      <div className="settings-label">{label}</div>
      <div className="settings-value">{value}</div>
      <div className="settings-action-slot">
        {action ? (
          <button type="button" className="settings-action" onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function InlineSelectRow({
  actionLabel = "change",
  label,
  onSave,
  options,
  value,
  valueLabel = value,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  function handleStartEdit() {
    setDraftValue(value);
    setIsEditing(true);
  }

  async function handleSave() {
    await onSave(draftValue);
    setIsEditing(false);
  }

  function handleCancel() {
    setDraftValue(value);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="settings-row">
        <div className="settings-label">{label}</div>
        <div className="settings-field-wrap">
          <select
            className="settings-control"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-action-group">
          <button type="button" className="settings-action" onClick={handleSave}>
            save
          </button>
          <button type="button" className="settings-action settings-action-muted" onClick={handleCancel}>
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-row">
      <div className="settings-label">{label}</div>
      <div className="settings-value">{valueLabel}</div>
      <div className="settings-action-slot">
        <button type="button" className="settings-action" onClick={handleStartEdit}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function InlineTextRow({ label, onSave, value }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  function handleStartEdit() {
    setDraftValue(value);
    setIsEditing(true);
  }

  async function handleSave() {
    await onSave(draftValue.trim());
    setIsEditing(false);
  }

  function handleCancel() {
    setDraftValue(value);
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="settings-row">
        <div className="settings-label">{label}</div>
        <div className="settings-field-wrap">
          <input
            className="settings-control"
            type="text"
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
          />
        </div>
        <div className="settings-action-group">
          <button type="button" className="settings-action" onClick={handleSave}>
            save
          </button>
          <button type="button" className="settings-action settings-action-muted" onClick={handleCancel}>
            cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-row">
      <div className="settings-label">{label}</div>
      <div className="settings-value">{value}</div>
      <div className="settings-action-slot">
        <button type="button" className="settings-action" onClick={handleStartEdit}>
          change
        </button>
      </div>
    </div>
  );
}

function ToggleRow({ label, onToggle, value }) {
  return (
    <div className="settings-row">
      <div className="settings-label">{label}</div>
      <div className="settings-value settings-value-sans">{formatBooleanToggle(value)}</div>
      <div className="settings-action-slot">
        <button type="button" className="settings-action" onClick={() => onToggle(!value)}>
          {formatBooleanToggle(value)}
        </button>
      </div>
    </div>
  );
}

function PersonalContextEditor({ value, onSave }) {
  const [draftValue, setDraftValue] = useState(value);
  const [saveError, setSaveError] = useState(null);
  const latestSavedValueRef = useRef(value);

  useEffect(() => {
    latestSavedValueRef.current = value;
    setDraftValue((currentDraft) => (currentDraft === latestSavedValueRef.current ? value : currentDraft));
  }, [value]);

  useEffect(() => {
    if (draftValue === latestSavedValueRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await onSave(draftValue);
        latestSavedValueRef.current = draftValue;
        setSaveError(null);
      } catch (caughtError) {
        setSaveError(caughtError);
      }
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [draftValue, onSave]);

  return (
    <div className="personal-context-editor">
      <textarea
        className="personal-context-textarea"
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        spellCheck={false}
      />
      <div className="settings-inline-note">used in every llm prompt. edit freely.</div>
      {saveError ? <div className="settings-error">{saveError.message}</div> : null}
    </div>
  );
}

function SettingsSection({ title, children, note = null, dimmed = false }) {
  return (
    <section className={`settings-section ${dimmed ? "is-dimmed" : ""}`}>
      <div className="settings-section-header">{title}</div>
      {note ? <div className="settings-note">{note}</div> : null}
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { config, error, isLoading, isPatching, patchConfig } = useConfig();

  async function handleChooseJournalFolder() {
    const selectedDirectory = await chooseDirectory();
    if (!selectedDirectory) {
      return;
    }

    await patchConfig({ journal_folder: selectedDirectory });
  }

  if (isLoading || !config) {
    return (
      <main className="main settings-page">
        <h1 className="page-title">settings</h1>
        <div className="settings-note">loading config…</div>
      </main>
    );
  }

  const journalFolder = config?.journal_folder ?? "—";

  return (
    <main className="main settings-page">
      <h1 className="page-title">settings</h1>
      {isPatching ? <div className="settings-note">saving changes…</div> : null}
      {error ? <div className="settings-error">{error.message}</div> : null}

      <SettingsSection title="storage">
        <div className="settings-row">
          <div className="settings-label">journal folder</div>
          <div className="settings-value">{journalFolder}</div>
          <div className="settings-action-slot">
            <button type="button" className="settings-action" onClick={handleChooseJournalFolder}>
              change
            </button>
          </div>
        </div>
        <div className="settings-inline-note">applies to future sessions only</div>
        <InlineSelectRow
          label="retention"
          value={String(config.retention_days)}
          valueLabel={formatRetentionValue(config.retention_days)}
          options={RETENTION_OPTIONS.map((days) => ({
            value: String(days),
            label: formatRetentionValue(days),
          }))}
          onSave={(nextValue) => patchConfig({ retention_days: Number(nextValue) })}
        />
        <SettingsRow label="disk used" action="" />
      </SettingsSection>

      <SettingsSection title="recording">
        <InlineSelectRow
          label="video quality"
          value={config.video_quality}
          options={VIDEO_QUALITY_OPTIONS.map((quality) => ({ value: quality, label: quality }))}
          onSave={(nextValue) => patchConfig({ video_quality: nextValue })}
        />
        <InlineSelectRow
          label="default language"
          value={config.language_default}
          valueLabel={formatLanguageValue(config.language_default)}
          options={LANGUAGE_OPTIONS.map((languageCode) => ({
            value: languageCode,
            label: formatLanguageValue(languageCode),
          }))}
          onSave={(nextValue) => patchConfig({ language_default: nextValue })}
        />
        <ToggleRow
          label="phone upload"
          value={config.phone_upload_enabled}
          onToggle={(nextValue) => patchConfig({ phone_upload_enabled: nextValue })}
        />
        <ToggleRow
          label="ready sound"
          value={config.ready_sound_enabled}
          onToggle={(nextValue) => patchConfig({ ready_sound_enabled: nextValue })}
        />
      </SettingsSection>

      <SettingsSection title="ai">
        <SettingsRow label="openrouter api key" value={config.openrouter.api_key || "—"} />
        <InlineTextRow
          label="model"
          value={config.openrouter.default_model}
          onSave={(nextValue) => patchConfig({ openrouter: { default_model: nextValue } })}
        />
        <InlineSelectRow
          label="directness"
          value={config.directness}
          options={[
            { value: "direct", label: "direct" },
            { value: "gentle", label: "gentle (v2)", disabled: true },
            { value: "brutal", label: "brutal (v2)", disabled: true },
          ]}
          onSave={(nextValue) => patchConfig({ directness: nextValue })}
        />
        <div className="settings-inline-note settings-inline-note-offset">
          gentle and brutal are reserved for v2.
        </div>
        <InlineSelectRow
          label="whisper model"
          value={config.whisper.model}
          options={WHISPER_MODEL_OPTIONS.map((modelName) => ({ value: modelName, label: modelName }))}
          onSave={(nextValue) => patchConfig({ whisper: { model: nextValue } })}
        />
      </SettingsSection>

      <SettingsSection title="personal context">
        <PersonalContextEditor
          value={config.personal_context}
          onSave={(nextValue) => patchConfig({ personal_context: nextValue })}
        />
      </SettingsSection>

      <SettingsSection title="telegram bot" note="phase 2 — not yet active" dimmed>
        <DisabledSettingsRow label="bot token" value="—" />
        <DisabledSettingsRow label="chat id" value="—" />
        <DisabledSettingsRow label="daily digest" value="08:00" />
        <DisabledSettingsRow label="weekly rollup" value="sunday 20:00" />
      </SettingsSection>

      <SettingsSection title="about">
        <SettingsRow label="version" value={config.app_version ?? "0.1.0"} action="" />
        <ActionSettingsRow
          label="config"
          value={config.config_path ?? "—"}
          onAction={() => openDesktopPath(config.config_path)}
        />
        <ActionSettingsRow
          label="logs"
          value={config.logs_path ?? "—"}
          onAction={() => openDesktopPath(config.logs_path)}
        />
      </SettingsSection>
    </main>
  );
}

function RecordingControls({ recorder }) {
  if (!ACTIVE_RECORDER_STATES.has(recorder.state)) {
    return null;
  }

  const isPaused = recorder.state === "paused";
  const isStopping = recorder.state === "stopping";

  return (
    <div className="record-live-controls" aria-label="Recording controls">
      <button
        type="button"
        className="record-secondary-button"
        disabled={isStopping}
        onClick={isPaused ? recorder.resumeRecording : recorder.pauseRecording}
      >
        <span aria-hidden="true">{isPaused ? "▶" : "‖"}</span>
        <span>{isPaused ? "resume" : "pause"}</span>
      </button>
      <button
        type="button"
        className="record-stop-button"
        disabled={isStopping}
        onClick={() => void recorder.stopRecording()}
      >
        <span aria-hidden="true">■</span>
        <span>{isStopping ? "stopping…" : "stop"}</span>
      </button>
    </div>
  );
}

function RecordPreview({ permissionState, recorder, videoRef }) {
  const isLivePreview = permissionState === "granted";
  const isActivePreview = ACTIVE_RECORDER_STATES.has(recorder.state);
  const isPaused = recorder.state === "paused";
  const placeholderMessage = getRecordingPermissionMessage(permissionState);

  return (
    <div className={`record-preview-frame ${isActivePreview ? "is-active" : "is-idle"}`}>
      {isLivePreview ? (
        <>
          <video
            ref={videoRef}
            className={`record-preview-video ${isActivePreview ? "is-active" : "is-idle"} is-live`}
            autoPlay
            muted
            playsInline
          />
          {isActivePreview ? (
            <div className={`record-timer-overlay ${isPaused ? "is-paused" : ""}`}>
              <span className="record-timer-dot" aria-hidden="true" />
              <span>{formatRecordingTimer(recorder.elapsedSeconds)}</span>
            </div>
          ) : null}
        </>
      ) : (
        <div
          className={`record-preview-placeholder ${permissionState === "denied" ? "is-denied" : "is-requesting"}`}
          aria-live="polite"
        >
          {placeholderMessage}
        </div>
      )}
    </div>
  );
}

function ReviewState({
  actionError,
  actionState,
  language,
  onBack,
  onCancelDiscard,
  onConfirmDiscard,
  onDiscard,
  onFinalize,
  showDiscardConfirm,
  title,
  onTitleChange,
  videoUrl,
  videoStats,
}) {
  return (
    <>
      <div className="record-review-frame">
        <video className="record-review-video" src={videoUrl} controls autoPlay playsInline />
        <div className="record-review-meta">
          {videoStats.durationLabel} · {language} · {videoStats.fileSizeLabel}
        </div>
      </div>

      <input
        className="record-title-input"
        type="text"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="title (optional) — what was this about?"
      />

      {actionError ? <div className="record-review-error">{actionError}</div> : null}

      <div className="record-review-actions">
        <div className="record-review-left">
          {showDiscardConfirm ? (
            <div className="record-discard-confirm" aria-label="Discard confirmation">
              <button
                type="button"
                className="record-discard-action"
                disabled={actionState !== "idle"}
                onClick={onCancelDiscard}
              >
                cancel
              </button>
              <button
                type="button"
                className="record-discard-action record-discard-danger"
                disabled={actionState !== "idle"}
                onClick={onConfirmDiscard}
              >
                yes, discard
              </button>
            </div>
          ) : (
            <button type="button" className="record-discard" disabled={actionState !== "idle"} onClick={onDiscard}>
              discard
            </button>
          )}
        </div>
        <div className="record-review-right">
          <button
            type="button"
            className="record-secondary-button"
            disabled={actionState !== "idle"}
            onClick={() => void onFinalize("video_only")}
          >
            video only
          </button>
          <button
            type="button"
            className="record-secondary-button"
            disabled={actionState !== "idle"}
            onClick={() => void onFinalize("transcribe_only")}
          >
            transcribe only
          </button>
          <button
            type="button"
            className="record-start-button"
            disabled={actionState !== "idle"}
            onClick={() => void onFinalize("full")}
          >
            {actionState === "saving" ? "saving…" : "save & process"}
          </button>
        </div>
      </div>

      <div className="record-review-footer">
        <button type="button" className="record-back" onClick={onBack}>
          ← today
        </button>
      </div>
    </>
  );
}

function RecordPage({ onBack }) {
  const { config } = useConfig();
  const { refreshIndex } = useIndex();
  const [actionError, setActionError] = useState(null);
  const [actionState, setActionState] = useState("idle");
  const [permissionState, setPermissionState] = useState("requesting");
  const [reviewTitle, setReviewTitle] = useState("");
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [stream, setStream] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(config?.language_default ?? "en");
  const videoRef = useRef(null);
  const recorder = useRecorder({ language: selectedLanguage, stream });
  const isActiveRecording = ACTIVE_RECORDER_STATES.has(recorder.state);
  const isReviewState = recorder.state === "stopped" && recorder.recordedBlobUrl;
  const reviewStats = {
    durationLabel: formatRecordingDurationLabel(recorder.elapsedSeconds),
    fileSizeLabel: formatRecordingFileSize(recorder.recordedBlob?.size ?? 0),
  };

  useEffect(() => {
    if (config?.language_default) {
      setSelectedLanguage(config.language_default);
    }
  }, [config?.language_default]);

  useEffect(() => {
    let isActive = true;
    let activeStream = null;

    async function setupStream() {
      try {
        const nextStream = await requestRecordingStream();
        if (!isActive) {
          stopMediaStream(nextStream);
          return;
        }
        activeStream = nextStream;
        setStream(nextStream);
        setPermissionState("granted");
      } catch (caughtError) {
        if (isActive) {
          setPermissionState("denied");
          if (!isPermissionDeniedError(caughtError)) {
            setActionError(caughtError instanceof Error ? caughtError.message : "Camera access not available.");
          }
        }
      }
    }

    void setupStream();

    return () => {
      isActive = false;
      stopMediaStream(activeStream);
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  useEffect(() => {
    if (recorder.state === "stopped" && stream) {
      stopMediaStream(stream);
      setStream(null);
    }
  }, [recorder.state, stream]);

  useEffect(() => {
    if (recorder.state === "stopped") {
      setReviewTitle("");
      setActionState("idle");
      setActionError(null);
      setShowDiscardConfirm(false);
    }
  }, [recorder.sessionId, recorder.state]);

  useEffect(() => {
    if (!showDiscardConfirm) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShowDiscardConfirm(false);
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showDiscardConfirm]);

  useEffect(() => {
    if (!isActiveRecording) {
      return undefined;
    }

    const handleBeforeUnload = createBeforeUnloadHandler(recorder.state);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isActiveRecording, recorder.state]);

  useEffect(() => {
    function handleKeyDown(event) {
      const action = getRecordShortcutAction({
        event,
        permissionState,
        recorderState: recorder.state,
        showDiscardConfirm,
      });

      if (!action) {
        return;
      }

      event.preventDefault();

      if (action === "start") {
        void handleStartRecording();
        return;
      }

      if (action === "pause") {
        recorder.pauseRecording();
        return;
      }

      if (action === "resume") {
        recorder.resumeRecording();
        return;
      }

      if (action === "stop") {
        void recorder.stopRecording();
        return;
      }

      if (action === "save-full") {
        void handleFinalize("full");
        return;
      }

      if (action === "discard") {
        void handleDiscard();
        return;
      }

      if (action === "cancel-discard") {
        handleCancelDiscard();
        return;
      }

      if (action === "back") {
        onBack();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onBack, permissionState, recorder, showDiscardConfirm]);

  async function handleStartRecording() {
    try {
      setActionError(null);
      await recorder.startRecording();
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : "Failed to start recording.");
    }
  }

  async function handleFinalize(saveMode) {
    if (!recorder.sessionId) {
      return;
    }

    setActionState("saving");
    setActionError(null);

    try {
      await finalizeSession(recorder.sessionId, {
        title: reviewTitle.trim() || null,
        save_mode: saveMode,
      });
      await refreshIndex();
      onBack();
    } catch (caughtError) {
      setActionState("idle");
      setActionError(caughtError instanceof Error ? caughtError.message : "Failed to finalize recording.");
    }
  }

  async function handleDiscard() {
    setShowDiscardConfirm(true);
  }

  function handleCancelDiscard() {
    setShowDiscardConfirm(false);
  }

  async function handleConfirmDiscard() {
    if (!recorder.sessionId) {
      onBack();
      return;
    }

    setActionState("saving");
    setActionError(null);

    try {
      await deleteSession(recorder.sessionId);
      await refreshIndex();
      onBack();
    } catch (caughtError) {
      setActionState("idle");
      setActionError(caughtError instanceof Error ? caughtError.message : "Failed to discard recording.");
    }
  }

  return (
    <main className="main record-page">
      <div className="record-shell">
        <div className="record-shell-header">
          <div className="record-shell-meta">new session</div>
          <div className="record-language-row" aria-label="Session language">
            {[
              ["en", "en"],
              ["fr", "fr"],
              ["es", "es"],
              ["tmz", "tamazight"],
            ].map(([code, label], index) => (
              <div key={code} className="record-language-group">
                {index > 0 ? <span className="record-language-separator">·</span> : null}
                <button
                  type="button"
                  className={`record-language-button ${selectedLanguage === code ? "active" : ""}`}
                  disabled={isActiveRecording || isReviewState}
                  onClick={() => setSelectedLanguage(code)}
                >
                  {label}
                </button>
              </div>
            ))}
          </div>
        </div>

        {isReviewState ? (
          <ReviewState
            actionError={actionError}
            actionState={actionState}
            language={selectedLanguage}
            onBack={onBack}
            onCancelDiscard={handleCancelDiscard}
            onConfirmDiscard={handleConfirmDiscard}
            onDiscard={handleDiscard}
            onFinalize={handleFinalize}
            onTitleChange={setReviewTitle}
            showDiscardConfirm={showDiscardConfirm}
            title={reviewTitle}
            videoStats={reviewStats}
            videoUrl={recorder.recordedBlobUrl}
          />
        ) : isActiveRecording ? (
          <>
            <RecordPreview permissionState={permissionState} recorder={recorder} videoRef={videoRef} />
            {recorder.error ? <div className="record-review-error">{recorder.error.message}</div> : null}
            <RecordingControls recorder={recorder} />
          </>
        ) : (
          <>
            <RecordPreview permissionState={permissionState} recorder={recorder} videoRef={videoRef} />
            {recorder.error ? <div className="record-review-error">{recorder.error.message}</div> : null}
            <div className="record-shell-footer">
              <div className="record-footer-status">
                {permissionState === "granted"
                  ? "camera ready"
                  : permissionState === "requesting"
                    ? "waiting for permission"
                    : "camera unavailable"}
              </div>
              <div className="record-action-group">
                <button
                  type="button"
                  className="record-start-button"
                  disabled={permissionState !== "granted" || recorder.state !== "idle"}
                  onClick={handleStartRecording}
                >
                  <span className="record-dot" aria-hidden="true" />
                  <span>start</span>
                </button>
                <button type="button" className="record-back" onClick={onBack}>
                  ← today
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(createPageRoute("today"));
  const activePage = getActiveNavKey(route);

  function handleNavigate(nextPage) {
    setRoute(createPageRoute(nextPage));
  }

  return (
    <div className="app-shell">
      {isRecordRoute(route) ? null : <LeftRail activePage={activePage} onNavigate={handleNavigate} />}
      {route.name === "settings" ? <SettingsPage /> : null}
      {route.name === "record" ? <RecordPage onBack={() => setRoute(createPageRoute("today"))} /> : null}
      {route.name === "today" ? <TodayPage /> : null}
      {route.name === "gallery" ? <GalleryPage /> : null}
      {route.name === "trends" ? <TrendsPage /> : null}
      {route.name === "session" ? (
        <SessionDetailPlaceholder
          sessionId={route.params.sessionId}
          onBack={() => setRoute(createPageRoute("gallery"))}
        />
      ) : null}
    </div>
  );
}
