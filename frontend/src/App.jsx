import { useIndex } from "./hooks/useIndex.js";

const navItems = ["today", "gallery", "trends", "settings"];

function LeftRail() {
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
        {navItems.map((item, index) => (
          <button
            key={item}
            type="button"
            className={`nav-item ${index === 0 ? "active" : ""}`}
            aria-current={index === 0 ? "page" : undefined}
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
  return (
    <main className="main">
      <div className="date-line">thursday · 24 april 2026</div>
      <div className="status-line">you haven&apos;t recorded today yet.</div>

      <section className="welcome-block" aria-label="Welcome">
        <p>welcome back.</p>
        <p>
          no sessions yet. when you&apos;re ready, click record on the left to start your first one.
        </p>
        <p>
          one more thing — set your openrouter key in settings if you want ai analysis. you can
          skip it and just record.
        </p>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <LeftRail />
      <TodayPage />
    </div>
  );
}
