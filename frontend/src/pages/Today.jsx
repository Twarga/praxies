import { AlertCircle, Flame, Loader2, Mic, PlayCircle, Target, Trophy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { loadSession, loadTodayDigest } from "../api/sessions.js";
import { getPracticeCurrent } from "../api/practice.js";
import { StreakGrid } from "../components/StreakGrid.jsx";
import { TodayWorkspace } from "../components/praxis/TodayWorkspace.jsx";
import { useIndex } from "../hooks/useIndex.js";
import {
  formatDurationMinutes,
  formatShortDate,
  getProcessingLabel,
  getSessionTitle,
  isAttentionStatus,
  isProcessingStatus,
} from "../lib/sessionUi.js";

const RECOVERY_BANNER_DISMISSED_KEY = "praxis.dismissedRecoveryBannerSessionIds";

function isInLastSevenDays(value) {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 7 * 24 * 60 * 60 * 1000;
}

function readDismissedRecoveryIds() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(RECOVERY_BANNER_DISMISSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function dismissRecoveryId(sessionId) {
  const dismissed = readDismissedRecoveryIds();
  dismissed.add(sessionId);
  window.localStorage.setItem(
    RECOVERY_BANNER_DISMISSED_KEY,
    JSON.stringify(Array.from(dismissed).slice(-100)),
  );
}

function getPrimaryLanguage(byLanguage) {
  if (!byLanguage) return "—";
  const entries = Object.entries(byLanguage);
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  const [code] = entries[0];
  if (code === "en") return "EN-US";
  if (code === "fr") return "FR-FR";
  if (code === "es") return "ES-ES";
  return code.toUpperCase();
}

function getLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayQualifyingMinutes(sessions) {
  const todayKey = getLocalDateKey();
  const totalSeconds = (sessions ?? []).reduce((sum, session) => {
    const sessionKey = getLocalDateKey(session.created_at);
    const durationSeconds = Number(session.duration_seconds) || 0;
    if (sessionKey !== todayKey || durationSeconds < 120) return sum;
    return sum + durationSeconds;
  }, 0);

  return Math.round(totalSeconds / 60);
}

function getLastSevenPracticeDays(sessions) {
  const buckets = new Map();

  for (const session of sessions ?? []) {
    const key = getLocalDateKey(session.created_at);
    const durationSeconds = Number(session.duration_seconds) || 0;
    if (!key || durationSeconds < 120) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + durationSeconds);
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: 7 }, (_entry, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = getLocalDateKey(date);
    const seconds = buckets.get(key) ?? 0;

    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1),
      minutes: Math.round(seconds / 60),
      complete: seconds >= 120,
      isToday: index === 6,
    };
  });
}

function getNextMilestone(currentStreak) {
  return [3, 7, 14, 30, 60, 100].find((milestone) => milestone > currentStreak) ?? currentStreak + 50;
}

function StreakStatusCard({ streak, sessions, onRecord }) {
  const current = Number(streak?.current) || 0;
  const longest = Number(streak?.longest) || 0;
  const todayMinutes = getTodayQualifyingMinutes(sessions);
  const hasCheckedInToday = todayMinutes >= 2;
  const nextMilestone = getNextMilestone(current);
  const progress = Math.min(100, Math.round((current / nextMilestone) * 100));
  const dayLabel = current === 1 ? "day" : "days";
  const weekDays = getLastSevenPracticeDays(sessions);

  return (
    <div className="relative overflow-hidden bg-[var(--praxis-bg-panel)] rounded-lg border border-[var(--praxis-line-subtle)] p-5 praxis-fade-in">
      <div className="absolute inset-0 pointer-events-none opacity-60 bg-[var(--praxis-success-radial)]" />
      <div className="relative flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-success)]">
            <Flame size={14} className={hasCheckedInToday ? "streak-flame" : ""} />
            Daily Streak
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="text-5xl leading-none font-light text-[var(--praxis-text-primary)] tnum tracking-[-0.05em]">
              {current}
            </div>
            <div className="pb-2">
              <div className="text-sm uppercase tracking-widest text-[var(--praxis-text-primary)]">{dayLabel}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                Longest {longest}
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-[420px] text-sm leading-relaxed text-[var(--praxis-text-muted)]">
            {hasCheckedInToday
              ? `Today is locked with ${todayMinutes} qualifying minutes.`
              : "Record at least 2 minutes today to protect the chain."}
          </p>
        </div>

        <button
          type="button"
          onClick={onRecord}
          className={`shrink-0 rounded-lg border px-4 py-3 text-left transition-colors ${
            hasCheckedInToday
              ? "border-[var(--praxis-success)]/35 bg-[var(--praxis-success)]/10 hover:bg-[var(--praxis-success)]/15"
              : "border-[var(--praxis-warning)]/35 bg-[var(--praxis-warning)]/10 hover:bg-[var(--praxis-warning)]/15"
          }`}
        >
          <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
            Today
          </div>
          <div className="mt-1 text-xs font-semibold uppercase tracking-widest text-[var(--praxis-text-primary)]">
            {hasCheckedInToday ? "Checked" : "Start"}
          </div>
          <div className="mt-1 text-[10px] text-[var(--praxis-text-muted)]">
            {hasCheckedInToday ? `${todayMinutes} min` : "2 min goal"}
          </div>
        </button>
      </div>

      <div className="relative mt-5 grid grid-cols-7 gap-1.5">
        {weekDays.map((day) => (
          <div key={day.key} className="text-center">
            <div className="mb-1 text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
              {day.label}
            </div>
            <div
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-mono tnum ${
                day.complete
                  ? "border-[var(--praxis-success)]/45 bg-[var(--praxis-success)]/15 text-[var(--praxis-success)]"
                  : day.isToday
                    ? "border-[var(--praxis-warning)]/45 bg-[var(--praxis-warning)]/10 text-[var(--praxis-warning)]"
                    : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-muted)]"
              }`}
              title={`${day.key} · ${day.minutes} min`}
            >
              {day.complete ? "✓" : day.isToday ? "!" : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2 font-mono">
        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)]/80 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[var(--praxis-text-muted)]">
            Next
          </div>
          <div className="mt-1 text-sm text-[var(--praxis-text-primary)] tnum">{nextMilestone}d</div>
        </div>
        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)]/80 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[var(--praxis-text-muted)]">
            Left
          </div>
          <div className="mt-1 text-sm text-[var(--praxis-text-primary)] tnum">{Math.max(nextMilestone - current, 0)}d</div>
        </div>
        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)]/80 px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-[var(--praxis-text-muted)]">
            Status
          </div>
          <div className={`mt-1 text-sm tnum ${hasCheckedInToday ? "text-[var(--praxis-success)]" : "text-[var(--praxis-warning)]"}`}>
            {hasCheckedInToday ? "safe" : "open"}
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
          <span>Milestone progress</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--praxis-bg-app)] border border-[var(--praxis-line-subtle)]">
          <div
            className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--praxis-warning)] to-[var(--praxis-success)] streak-progress"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
        <Trophy size={13} className="text-[var(--praxis-warning)]" />
        Streak counts only sessions of 2+ minutes.
      </div>
    </div>
  );
}

function getFallbackBannerCopy(session, bundle) {
  const meta = bundle?.meta;
  const errorText = meta?.error || session?.error || "";
  const error = String(errorText).toLowerCase();

  if (session?.status === "video_only" || meta?.save_mode === "video_only") {
    return {
      tone: "neutral",
      eyebrow: "analysis skipped",
      title: "Saved as video only",
      body: "This take was saved without transcription or AI analysis. Open it to review the raw recording.",
      action: "Open video",
    };
  }

  if (meta?.save_mode === "transcribe_only") {
    return {
      tone: "neutral",
      eyebrow: "analysis skipped",
      title: "Transcript-only session",
      body: "This take has a transcript, but AI analysis was intentionally skipped.",
      action: "Open transcript",
    };
  }

  if (error.includes("api key") || error.includes("401") || error.includes("unauthorized")) {
    return {
      tone: "warning",
      eyebrow: "openrouter attention",
      title: "API key needs attention",
      body: "The session could not be analyzed because the OpenRouter key is missing or invalid. Fix it in Settings, then retry the session.",
      action: "Review recovery",
    };
  }

  if (error.includes("credit") || error.includes("402") || error.includes("payment")) {
    return {
      tone: "warning",
      eyebrow: "openrouter attention",
      title: "OpenRouter credits exhausted",
      body: "The transcript is saved, but analysis could not run because the account has no available credits.",
      action: "Review recovery",
    };
  }

  if (error.includes("malformed") || error.includes("json") || error.includes("schema")) {
    return {
      tone: "warning",
      eyebrow: "model output rejected",
      title: "Analysis response was malformed",
      body: "The transcript is saved, but the model returned output that did not match the required analysis schema. You can retry or import external JSON.",
      action: "Open fallback",
    };
  }

  if (session?.status === "failed") {
    return {
      tone: "danger",
      eyebrow: "processing failed",
      title: "Session processing failed",
      body: errorText || "The local pipeline failed before the session became ready. Open the session to inspect the processing log.",
      action: "Inspect session",
    };
  }

  if (session?.status === "needs_attention") {
    return {
      tone: "warning",
      eyebrow: "needs attention",
      title: "Analysis needs manual recovery",
      body: errorText || "The transcript is saved, but AI analysis needs a retry or manual import.",
      action: "Recover analysis",
    };
  }

  return null;
}

function getRecoveryBannerCopy(session, bundle) {
  const meta = bundle?.meta;
  const terminalLines = meta?.processing?.terminal_lines ?? [];
  const terminalText = terminalLines.map((line) => line.message).join("\n").toLowerCase();
  const progressLabel = String(meta?.processing?.progress_label || "").toLowerCase();
  const errorText = String(meta?.error || session?.error || "").toLowerCase();
  const isRecoverySession =
    terminalText.includes("startup recovery") ||
    progressLabel.includes("recovered for review") ||
    progressLabel.includes("startup recovery failed") ||
    errorText.includes("corrupt unfinished recording") ||
    errorText.includes("interrupted before finalize");

  if (!isRecoverySession) {
    return null;
  }

  if (meta?.status === "video_only" || session?.status === "video_only") {
    return {
      tone: "warning",
      eyebrow: "startup recovery",
      title: "Recovered an unfinished recording",
      body: "Praxis found a recording from a previous interrupted session and saved the playable video for review.",
      action: "Open recovered video",
    };
  }

  return {
    tone: "danger",
    eyebrow: "startup recovery",
    title: "A recording could not be recovered",
    body: meta?.error || session?.error || "Praxis found an unfinished recording, but the saved chunks were not playable.",
    action: "Inspect recovery log",
  };
}

export function Today({ onNavigate, scrollRef }) {
  const { index } = useIndex();
  const sessions = index?.sessions ?? [];
  const isFirstLaunch = sessions.length === 0;
  const processing = sessions.filter((s) => isProcessingStatus(s.status));
  const needsAttention = sessions.filter((s) => isAttentionStatus(s.status));
  const skippedAnalysis = sessions.filter(
    (s) => s.status === "video_only" || s.save_mode === "transcribe_only",
  );
  const fallbackSession = needsAttention[0] || skippedAnalysis[0] || null;
  const [todayDigest, setTodayDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(true);
  const [fallbackBundle, setFallbackBundle] = useState(null);
  const [recoveryBanner, setRecoveryBanner] = useState(null);
  const [practiceCurrent, setPracticeCurrent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setDigestLoading(true);
    loadTodayDigest()
      .then((payload) => {
        if (!cancelled) setTodayDigest(payload.digest ?? null);
      })
      .catch(() => {
        if (!cancelled) setTodayDigest(null);
      })
      .finally(() => {
        if (!cancelled) setDigestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [index?.generated_at]);

  useEffect(() => {
    void getPracticeCurrent().then(setPracticeCurrent).catch(() => setPracticeCurrent(null));
  }, [index?.generated_at]);

  useEffect(() => {
    if (!fallbackSession) {
      setFallbackBundle(null);
      return undefined;
    }

    let cancelled = false;
    loadSession(fallbackSession.id)
      .then((bundle) => {
        if (!cancelled) setFallbackBundle(bundle);
      })
      .catch(() => {
        if (!cancelled) setFallbackBundle(null);
      });

    return () => {
      cancelled = true;
    };
  }, [fallbackSession?.id]);

  useEffect(() => {
    let cancelled = false;
    const dismissedIds = readDismissedRecoveryIds();
    const candidates = sessions
      .filter((session) => ["video_only", "failed"].includes(session.status))
      .filter((session) => !dismissedIds.has(session.id))
      .slice(0, 12);

    if (candidates.length === 0) {
      setRecoveryBanner(null);
      return undefined;
    }

    Promise.all(
      candidates.map((session) =>
        loadSession(session.id)
          .then((bundle) => ({ session, bundle }))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      const match = results
        .filter(Boolean)
        .map((entry) => ({
          ...entry,
          banner: getRecoveryBannerCopy(entry.session, entry.bundle),
        }))
        .find((entry) => entry.banner);

      setRecoveryBanner(match ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [index?.generated_at, sessions]);

  const recentSessions = sessions.filter((s) => isInLastSevenDays(s.created_at));
  const weeklyCount = recentSessions.length;
  const weeklyMinutes = Math.round(
    recentSessions.reduce((acc, s) => acc + (Number(s.duration_seconds) || 0), 0) / 60,
  );
  const totalsByLang = index?.totals?.by_language ?? {};
  const primaryLanguage = getPrimaryLanguage(totalsByLang);
  const streak = index?.streak ?? {};

  const fallbackBanner = getFallbackBannerCopy(fallbackSession, fallbackBundle);
  const visibleFallbackSession =
    fallbackSession?.id && fallbackSession.id !== recoveryBanner?.session?.id
      ? fallbackSession
      : null;
  const digestSession = todayDigest?.session ?? null;
  const digestAnalysis = todayDigest?.analysis ?? null;
  const digestPractice = Number(digestAnalysis?.schema_version) === 3
    ? digestAnalysis?.report?.practice ?? {}
    : digestAnalysis?.coaching_report?.practice_assignment ?? {};
  const digestActions = [
    digestPractice.reflection_question,
    digestPractice.speaking_drill,
    digestPractice.next_session_goal,
    digestPractice.instructions,
    digestAnalysis?.report?.next_goal?.text,
  ].filter(Boolean).slice(0, 3);
  const fallbackDigestActions = (digestAnalysis?.actionable_improvements ?? []).slice(0, 3);
  const visibleDigestActions = digestActions.length ? digestActions : fallbackDigestActions;
  const digestHeadline =
    digestAnalysis?.report?.verdict || digestAnalysis?.coaching_report?.headline || digestAnalysis?.prose_verdict || "";

  if (isFirstLaunch) {
    return (
      <div ref={scrollRef} className="flex h-full flex-col overflow-y-auto bg-[var(--praxis-bg-canvas)]">
        <header className="praxis-reading-surface flex h-12 shrink-0 items-center justify-between border-b border-[var(--praxis-line-subtle)] px-6">
          <div>
            <h1 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Today</h1>
            <p className="mt-0.5 text-[11px] text-[var(--praxis-text-muted)]">Your daily speaking practice starts here.</p>
          </div>
          <span className="rounded-md bg-[var(--praxis-bg-elevated)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--praxis-text-secondary)]">First launch</span>
        </header>

        <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-6 py-10">
          <section className="w-full rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-6 sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-record)]">
              <Mic size={20} />
            </div>
            <h2 className="mt-5 max-w-[24ch] text-2xl font-semibold tracking-[-0.02em] text-[var(--praxis-text-primary)]">Start your first journal session.</h2>
            <p className="mt-3 max-w-[65ch] text-sm leading-7 text-[var(--praxis-text-secondary)]">
              Record at least two minutes. Praxis keeps the video on this device, turns it into a readable report, and gives you one focused goal for the next session.
            </p>

            <div className="mt-7 divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">
              {[
                ["Record", "Speak naturally for two to three minutes."],
                ["Review", "See the exact moment behind each piece of feedback."],
                ["Practice", "Use one clear next goal before you record again."],
              ].map(([title, body]) => (
                <div key={title} className="grid gap-1 py-3 sm:grid-cols-[112px_1fr] sm:gap-6">
                  <div className="text-[11px] font-medium text-[var(--praxis-accent)]">{title}</div>
                  <p className="text-sm leading-6 text-[var(--praxis-text-secondary)]">{body}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate("record")}
              className="mt-7 inline-flex h-9 items-center gap-2 rounded-md bg-[var(--praxis-record)] px-3.5 text-xs font-semibold text-[var(--praxis-on-record)] transition-colors hover:brightness-110"
            >
              <Mic size={14} />
              Record first session
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <TodayWorkspace
      practice={practiceCurrent}
      sessions={sessions}
      processing={processing}
      needsAttention={needsAttention}
      streak={streak}
      weeklyCount={weeklyCount}
      weeklyMinutes={weeklyMinutes}
      digestHeadline={digestHeadline}
      digestActions={visibleDigestActions}
      onNavigate={onNavigate}
    />
  );
}
