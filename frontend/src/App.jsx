import { useState } from "react";
import { useConfig } from "./hooks/useConfig.js";
import { useIndex } from "./hooks/useIndex.js";

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
      <button type="button" className="settings-action">
        {action}
      </button>
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
  const { config } = useConfig();
  const journalFolder = config?.journal_folder ?? "—";

  return (
    <main className="main settings-page">
      <h1 className="page-title">settings</h1>

      <SettingsSection title="storage">
        <SettingsRow label="journal folder" value={journalFolder} />
        <div className="settings-inline-note">applies to future sessions only</div>
        <SettingsRow label="retention" action="change" />
        <SettingsRow label="disk used" action="" />
      </SettingsSection>

      <SettingsSection title="recording">
        <SettingsRow label="video quality" />
        <SettingsRow label="default language" />
        <SettingsRow label="phone upload" action="off" />
      </SettingsSection>

      <SettingsSection title="ai">
        <SettingsRow label="openrouter api key" />
        <SettingsRow label="model" />
        <SettingsRow label="directness" />
        <SettingsRow label="whisper model" />
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
