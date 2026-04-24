import { useState } from "react";
import { useConfig } from "./hooks/useConfig.js";
import { useIndex } from "./hooks/useIndex.js";
import { chooseDirectory } from "./lib/desktop.js";
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
        <button type="button" className="record-button">
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
        <div className="settings-placeholder-block" />
      </SettingsSection>

      <SettingsSection title="telegram bot" note="phase 2 — not yet active" dimmed>
        <SettingsRow label="bot token" action="" />
        <SettingsRow label="chat id" action="" />
        <SettingsRow label="daily digest" action="" />
        <SettingsRow label="weekly rollup" action="" />
      </SettingsSection>

      <SettingsSection title="about">
        <SettingsRow label="version" action="" />
        <SettingsRow label="config" />
        <SettingsRow label="logs" />
      </SettingsSection>
    </main>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("today");

  return (
    <div className="app-shell">
      <LeftRail activePage={activePage} onNavigate={setActivePage} />
      {activePage === "settings" ? <SettingsPage /> : <TodayPage />}
    </div>
  );
}
