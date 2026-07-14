import { BookOpen, CheckCircle2, Clock, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { CoachingVerdict } from "./CoachingVerdict.jsx";
import { EvidenceMoment } from "./EvidenceMoment.jsx";

function formatSecondsTimestamp(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = String(Math.floor(safe / 60)).padStart(2, "0");
  const secs = String(safe % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function ListBlock({ title, items, accent }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">{title}</h3>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`${title}-${index}`}
            className={`p-3 bg-[var(--praxis-bg-panel-raised)] border-l-2 text-sm text-[var(--praxis-text-primary)] ${
              accent === "accent"
                ? "border-[var(--praxis-accent)]"
                : accent === "danger"
                  ? "border-[var(--praxis-danger)]"
                  : "border-[var(--praxis-warning)]"
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PatternsHitTodayBlock({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Patterns Hit Today
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-warning)]">
          {items.length} hit{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={`patterns-hit-today-${index}`}
            className="p-3 bg-[var(--praxis-bg-panel-raised)] border-l-2 border-[var(--praxis-warning)] text-sm text-[var(--praxis-text-primary)]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatBlock({ label, value }) {
  return (
    <div className="p-4 bg-[var(--praxis-bg-panel-raised)] border border-[var(--praxis-line-subtle)] rounded-lg">
      <div className="text-[10px] opacity-40 uppercase mb-1 font-mono tracking-widest">
        {label}
      </div>
      <div className="text-sm font-medium mt-2 text-[var(--praxis-text-primary)] leading-relaxed">{value}</div>
    </div>
  );
}

export function FillerWords({ map }) {
  const entries = Object.entries(map || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([word, count]) => (
        <span
          key={word}
          className="px-2 py-1 rounded bg-[var(--praxis-bg-panel-raised)] border border-[var(--praxis-line-subtle)] text-xs text-[var(--praxis-text-secondary)] font-mono"
        >
          {word} <span className="opacity-50">.{count}</span>
        </span>
      ))}
    </div>
  );
}

const SCORECARD_METRICS = [
  ["clarity", "Clarity"],
  ["structure", "Structure"],
  ["reflection_depth", "Reflection Depth"],
  ["emotional_awareness", "Emotional Awareness"],
  ["specificity", "Specificity"],
  ["actionability", "Actionability"],
  ["language_fluency", "Language Fluency"],
];

function readableText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function hasReadableCoachingReport(analysis) {
  const report = analysis?.coaching_report || {};
  return Boolean(
    readableText(report.headline) ||
      readableText(report.opening_read) ||
      readableText(report.what_improved) ||
      readableText(report.what_held_back) ||
      (Array.isArray(report.top_lessons) && report.top_lessons.length > 0) ||
      (Array.isArray(report.moment_feedback) && report.moment_feedback.length > 0),
  );
}

function metricFallbackScore(analysis, id) {
  if (id === "clarity") return analysis?.speaking_quality?.clarity;
  if (id === "language_fluency") return analysis?.grammar_and_language?.fluency_score;
  return null;
}

function CoachingScorecard({ analysis }) {
  const scorecard = analysis?.scorecard || {};
  const rows = SCORECARD_METRICS.map(([id, label]) => {
    const metric = scorecard[id] || {};
    const score = metric.score ?? metricFallbackScore(analysis, id);
    return {
      id,
      label,
      score: Number.isFinite(Number(score)) ? Number(score) : null,
      evidence: readableText(metric.evidence),
      practiceFocus: readableText(metric.practice_focus),
    };
  }).filter((row) => row.score !== null || row.evidence || row.practiceFocus);

  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Session Scorecard
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
          evidence based
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                {row.label}
              </div>
              {row.score !== null ? (
                <div className="rounded bg-[var(--praxis-bg-app)] px-2 py-1 font-mono text-xs text-[var(--praxis-text-primary)] tnum">
                  {row.score}/10
                </div>
              ) : null}
            </div>
            {row.evidence ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{row.evidence}</p>
            ) : null}
            {row.practiceFocus ? (
              <p className="mt-2 border-l-2 border-[var(--praxis-accent)] pl-3 text-xs leading-relaxed text-[var(--praxis-text-muted)]">
                {row.practiceFocus}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachingLessons({ lessons }) {
  if (!Array.isArray(lessons) || lessons.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
        Top Lessons
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {lessons.map((lesson, index) => (
          <div key={`${lesson.title}-${index}`} className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4">
            <div className="flex items-start gap-4">
              <div className="shrink-0 rounded bg-[var(--praxis-bg-app)] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--praxis-accent)]">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-[var(--praxis-text-primary)] leading-snug">
                  {lesson.title || "Untitled lesson"}
                </h4>
                {lesson.what_happened ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">
                    {lesson.what_happened}
                  </p>
                ) : null}
                {lesson.why_it_matters ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-muted)]">
                    {lesson.why_it_matters}
                  </p>
                ) : null}
                {lesson.next_move ? (
                  <p className="mt-2 border-l-2 border-[var(--praxis-warning)] pl-3 text-xs leading-relaxed text-[var(--praxis-text-secondary)]">
                    {lesson.next_move}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MomentFeedback({ moments, bestMoment, onSeek }) {
  const rows = [
    ...(bestMoment?.coaching_note ? [{ ...bestMoment, label: bestMoment.label || "Best moment", isBest: true }] : []),
    ...(Array.isArray(moments) ? moments : []),
  ].filter((moment, index, all) => {
    const key = `${Number(moment.timestamp_seconds) || 0}-${moment.label || ""}-${moment.transcript_quote || ""}`;
    return all.findIndex((candidate) => `${Number(candidate.timestamp_seconds) || 0}-${candidate.label || ""}-${candidate.transcript_quote || ""}` === key) === index;
  });

  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
        Moments To Study
      </h3>
      <div className="space-y-2">
        {rows.map((moment, index) => {
          const timestamp = Number(moment.timestamp_seconds) || 0;
          return (
            <button
              key={`${timestamp}-${index}`}
              type="button"
              onClick={() => onSeek(timestamp)}
              className={`w-full rounded-lg border p-4 text-left transition-colors hover:border-[var(--praxis-accent)]/70 ${
                moment.isBest
                  ? "border-[var(--praxis-accent)]/45 bg-[var(--praxis-accent-muted)]"
                  : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--praxis-accent)] tnum">
                  {formatSecondsTimestamp(timestamp)}
                </span>
                <span className="text-sm font-semibold text-[var(--praxis-text-primary)]">
                  {moment.label || "Session moment"}
                </span>
                {moment.kind ? (
                  <span className="rounded bg-[var(--praxis-bg-app)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--praxis-text-muted)]">
                    {moment.kind.replace("_", " ")}
                  </span>
                ) : null}
              </div>
              {moment.transcript_quote ? (
                <p className="mt-3 text-sm italic leading-relaxed text-[var(--praxis-text-primary)]">
                  "{moment.transcript_quote}"
                </p>
              ) : null}
              {moment.coaching_note ? (
                <p className="mt-3 text-sm leading-relaxed text-[var(--praxis-text-muted)]">
                  {moment.coaching_note}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BehavioralPatterns({ patterns }) {
  if (!Array.isArray(patterns) || patterns.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">
        Behavior Patterns
      </h3>
      <div className="space-y-3">
        {patterns.map((pattern, index) => (
          <div key={`${pattern.name}-${index}`} className="border-l-2 border-[var(--praxis-warning)] pl-4">
            <h4 className="text-sm font-semibold text-[var(--praxis-text-primary)]">{pattern.name}</h4>
            {pattern.evidence ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{pattern.evidence}</p>
            ) : null}
            {pattern.impact ? (
              <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-muted)]">{pattern.impact}</p>
            ) : null}
            {pattern.correction ? (
              <p className="mt-2 text-xs leading-relaxed text-[var(--praxis-accent)]">{pattern.correction}</p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function PracticeAssignment({ assignment }) {
  if (!assignment) return null;
  const rows = [
    ["Reflection Question", assignment.reflection_question],
    ["Speaking Drill", assignment.speaking_drill],
    ["Behavioral Action", assignment.behavioral_action],
    ["Next Session Goal", assignment.next_session_goal],
  ].filter(([, value]) => readableText(value));

  if (!rows.length) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-accent)]/35 bg-[var(--praxis-accent-muted)] p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--praxis-accent)] mb-4">
        Practice Before Next Session
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded border border-[var(--praxis-accent)]/20 bg-[var(--praxis-bg-app)]/35 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
              {label}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportReadingPath({ analysis }) {
  const report = analysis?.coaching_report || {};
  const mainLesson = Array.isArray(report.top_lessons) ? report.top_lessons[0] : null;
  const assignment = report.practice_assignment || {};
  const bestMoment = report.best_moment || {};
  const practiceText =
    readableText(assignment.next_session_goal) ||
    readableText(assignment.speaking_drill) ||
    readableText(assignment.behavioral_action);

  const rows = [
    {
      key: "read",
      icon: BookOpen,
      label: "First Read",
      title: readableText(report.headline) || "What this session is about",
      body: readableText(report.opening_read) || readableText(analysis?.session_summary),
      tone: "orange",
    },
    {
      key: "lesson",
      icon: Target,
      label: "Lesson",
      title: readableText(mainLesson?.title) || "Main lesson",
      body: readableText(mainLesson?.why_it_matters) || readableText(mainLesson?.what_happened),
      tone: "green",
    },
    {
      key: "moment",
      icon: Clock,
      label: "Moment",
      title: bestMoment?.timestamp_seconds !== undefined
        ? `Study ${formatSecondsTimestamp(bestMoment.timestamp_seconds)}`
        : "Best moment",
      body: readableText(bestMoment.coaching_note) || readableText(bestMoment.transcript_quote),
      tone: "neutral",
    },
    {
      key: "practice",
      icon: CheckCircle2,
      label: "Practice",
      title: "Before the next session",
      body: practiceText,
      tone: "green",
    },
  ].filter((row) => readableText(row.body));

  if (rows.length < 2) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5 praxis-fade-in">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--praxis-text-muted)]">
            Read In This Order
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--praxis-text-muted)]">
            Start here, then go deeper only if you want the evidence.
          </p>
        </div>
        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
          explain mode
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {rows.map((row, index) => {
          const Icon = row.icon;
          const accent =
            row.tone === "green"
              ? "border-[var(--praxis-accent)]/35 text-[var(--praxis-accent)] bg-[var(--praxis-accent)]/10"
              : row.tone === "orange"
                ? "border-[var(--praxis-warning)]/35 text-[var(--praxis-warning)] bg-[var(--praxis-warning)]/10"
                : "border-[var(--praxis-line-subtle)] text-[var(--praxis-text-secondary)] bg-[var(--praxis-bg-panel-raised)]";

          return (
            <article key={row.key} className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded border ${accent}`}>
                  <Icon size={15} />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--praxis-text-muted)] tnum">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                {row.label}
              </div>
              <h4 className="mt-2 text-sm font-semibold leading-snug text-[var(--praxis-text-primary)]">{row.title}</h4>
              <p className="mt-3 text-sm leading-6 text-[var(--praxis-text-primary)]">{row.body}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

const PREVIOUS_GOAL_RESULTS = [
  { value: "followed", label: "Followed" },
  { value: "partially_followed", label: "Partial" },
  { value: "missed", label: "Missed" },
];

export function PracticeTracker({ meta, practiceContext, onUpdate }) {
  const practice = meta?.practice || {};
  const assignmentCompleted = Boolean(practice.assignment_completed);
  const previousGoal = readableText(practice.previous_goal) || readableText(practiceContext?.goal);
  const previousGoalSourceId =
    practice.previous_goal_source_session_id || practiceContext?.source_session_id || null;
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(practice.previous_goal_note || "");

  useEffect(() => {
    setNote(practice.previous_goal_note || "");
  }, [practice.previous_goal_note, meta?.id]);

  async function savePractice(payload) {
    setSaving(true);
    try {
      await onUpdate(payload);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Practice Tracking
        </h3>
        <button
          type="button"
          disabled={saving}
          onClick={() => void savePractice({ assignment_completed: !assignmentCompleted })}
          className={`rounded border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors disabled:opacity-60 ${
            assignmentCompleted
              ? "border-[var(--praxis-accent)]/40 bg-[var(--praxis-accent)]/15 text-[var(--praxis-accent)]"
              : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-muted)] hover:text-[var(--praxis-text-primary)]"
          }`}
        >
          {assignmentCompleted ? "Completed" : "Mark Complete"}
        </button>
      </div>

      {previousGoal ? (
        <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
            Previous Goal
          </div>
          <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{previousGoal}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {PREVIOUS_GOAL_RESULTS.map((result) => (
              <button
                key={result.value}
                type="button"
                disabled={saving}
                onClick={() =>
                  void savePractice({
                    previous_goal: previousGoal,
                    previous_goal_source_session_id: previousGoalSourceId,
                    previous_goal_result: result.value,
                  })
                }
                className={`rounded border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors disabled:opacity-60 ${
                  practice.previous_goal_result === result.value
                    ? "border-[var(--praxis-warning)]/50 bg-[var(--praxis-warning)]/15 text-[var(--praxis-warning)]"
                    : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] text-[var(--praxis-text-muted)] hover:text-[var(--praxis-text-primary)]"
                }`}
              >
                {result.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="optional note"
              className="min-w-0 flex-1 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-xs text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-accent)]"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void savePractice({
                  previous_goal: previousGoal,
                  previous_goal_source_session_id: previousGoalSourceId,
                  previous_goal_note: note,
                })
              }
              className="rounded bg-[var(--praxis-line-subtle)] px-3 py-2 text-xs font-medium text-[var(--praxis-text-primary)] transition-colors hover:bg-[var(--praxis-hover)] disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-[var(--praxis-text-muted)]">
          No previous next-session goal is available yet.
        </p>
      )}
    </div>
  );
}

function LanguageCoach({ languageCoach }) {
  if (!languageCoach) return null;
  const drills = Array.isArray(languageCoach.rewrite_drills) ? languageCoach.rewrite_drills : [];
  const hasContent =
    readableText(languageCoach.strongest_sentence) ||
    readableText(languageCoach.main_language_gap) ||
    drills.length > 0;

  if (!hasContent) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-4">
        Language Coach
      </h3>
      {languageCoach.strongest_sentence ? (
        <p className="text-sm leading-relaxed text-[var(--praxis-text-primary)]">
          <span className="text-[var(--praxis-accent)]">Strong sentence:</span>{" "}
          "{languageCoach.strongest_sentence}"
        </p>
      ) : null}
      {languageCoach.main_language_gap ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--praxis-text-muted)]">
          {languageCoach.main_language_gap}
        </p>
      ) : null}
      {drills.length ? (
        <div className="mt-4 space-y-3">
          {drills.map((drill, index) => (
            <div key={`${drill.timestamp_seconds}-${index}`} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--praxis-text-muted)] tnum">
                {formatSecondsTimestamp(drill.timestamp_seconds)}
              </div>
              <div className="text-sm leading-relaxed text-[var(--praxis-text-muted)]">
                {drill.original}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[var(--praxis-accent)]">
                {drill.improved}
              </div>
              {drill.explanation ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--praxis-text-muted)]">
                  {drill.explanation}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CoachFocus({ analysis }) {
  const report = analysis?.coaching_report || {};
  const mainLesson = Array.isArray(report.top_lessons) ? report.top_lessons[0] : null;
  const assignment = report.practice_assignment || {};
  const bestMoment = report.best_moment || {};
  const nextMove = readableText(mainLesson?.next_move) || readableText(assignment.next_session_goal);
  const quote = readableText(bestMoment.transcript_quote);
  const hasContent =
    readableText(mainLesson?.title) ||
    readableText(mainLesson?.why_it_matters) ||
    readableText(nextMove) ||
    readableText(assignment.speaking_drill) ||
    readableText(assignment.behavioral_action);

  if (!hasContent) return null;

  return (
    <div className="rounded-lg border border-[var(--praxis-accent)]/35 bg-[var(--praxis-accent-muted)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--praxis-accent)]">
          Coach Focus
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
          next session
        </span>
      </div>

      {mainLesson?.title ? (
        <h4 className="text-xl font-semibold leading-snug tracking-tight text-[var(--praxis-text-primary)]">
          {mainLesson.title}
        </h4>
      ) : null}

      {mainLesson?.why_it_matters ? (
        <p className="mt-3 text-base leading-7 text-[var(--praxis-text-primary)]">
          {mainLesson.why_it_matters}
        </p>
      ) : null}

      {quote ? (
        <blockquote className="mt-4 border-l-2 border-[var(--praxis-accent)] pl-4 text-sm italic leading-relaxed text-[var(--praxis-text-muted)]">
          "{quote}"
        </blockquote>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {nextMove ? (
          <div className="rounded border border-[var(--praxis-accent)]/20 bg-[var(--praxis-bg-app)]/35 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
              Main Move
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{nextMove}</p>
          </div>
        ) : null}
        {assignment.speaking_drill ? (
          <div className="rounded border border-[var(--praxis-accent)]/20 bg-[var(--praxis-bg-app)]/35 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
              Speaking Drill
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{assignment.speaking_drill}</p>
          </div>
        ) : null}
        {assignment.behavioral_action ? (
          <div className="rounded border border-[var(--praxis-accent)]/20 bg-[var(--praxis-bg-app)]/35 p-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
              Action
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-primary)]">{assignment.behavioral_action}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CoachingReport({ analysis, onSeek, currentTime = 0 }) {
  if (Number(analysis?.schema_version) === 3) {
    const report = analysis.report || {};
    return (
      <div className="space-y-5 praxis-fade-in">
        <CoachingVerdict
          verdict={report.verdict}
          strength={report.strength}
          improvement={report.priority_improvement}
          practice={report.practice}
          nextGoal={report.next_goal}
        />
        {report.evidence_moments?.length ? (
          <section className="space-y-3">
            <h3 className="text-[10px] font-mono uppercase tracking-[var(--praxis-tracking-label)] text-[var(--praxis-text-muted)]">
              Evidence from your recording
            </h3>
            {report.evidence_moments.map((moment, index) => (
              <EvidenceMoment key={`${moment.timestamp_seconds}-${index}`} timestamp={moment.timestamp_seconds}
                quote={moment.quote} explanation={moment.explanation} onSeek={onSeek}
                active={currentTime >= Number(moment.timestamp_seconds || 0) && currentTime < Math.min(Number(report.evidence_moments[index + 1]?.timestamp_seconds ?? Infinity), Number(moment.timestamp_seconds || 0) + 12)} />
            ))}
          </section>
        ) : null}
      </div>
    );
  }
  const report = analysis?.coaching_report || {};
  const headline = readableText(report.headline) || readableText(analysis?.prose_verdict);
  const hasReport = hasReadableCoachingReport(analysis) || headline;

  if (!hasReport) return null;

  return (
    <>
      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-[var(--praxis-warning)]" />
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
            Coaching Read
          </h3>
        </div>
        {headline ? (
          <h4 className="text-xl font-semibold tracking-tight text-[var(--praxis-text-primary)] leading-snug">
            {headline}
          </h4>
        ) : null}
        {report.opening_read ? (
          <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-[var(--praxis-text-primary)]">
            {report.opening_read}
          </p>
        ) : analysis?.session_summary ? (
          <p className="mt-4 text-base leading-7 text-[var(--praxis-text-primary)]">
            {analysis.session_summary}
          </p>
        ) : null}
      </div>

      <ReportReadingPath analysis={analysis} />
      <CoachFocus analysis={analysis} />
      <CoachingLessons lessons={report.top_lessons} />
      <PracticeAssignment assignment={report.practice_assignment} />
      <MomentFeedback moments={report.moment_feedback} bestMoment={report.best_moment} onSeek={onSeek} />

      {(report.what_improved || report.what_held_back) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.what_improved ? (
            <StatBlock label="What Improved" value={report.what_improved} />
          ) : null}
          {report.what_held_back ? (
            <StatBlock label="What Held You Back" value={report.what_held_back} />
          ) : null}
        </div>
      ) : null}

      <BehavioralPatterns patterns={report.behavioral_patterns} />
      <CoachingScorecard analysis={analysis} />
      <LanguageCoach languageCoach={analysis.language_coach} />
    </>
  );
}
