import { AlertCircle, Check, Loader2, Pencil, Trash2, Unlink2 } from "lucide-react";
import { useEffect, useState } from "react";
import { calibratePattern, loadPatterns, loadTrends } from "../api/trends.js";

const RANGE_OPTIONS = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "ALL" },
];

const LANGUAGE_SERIES = [
  { id: "en", label: "EN", color: "var(--praxis-success)" },
  { id: "fr", label: "FR", color: "var(--praxis-warning)" },
  { id: "es", label: "ES", color: "var(--praxis-accent)" },
];

function formatHours(value) {
  const numeric = Number(value) || 0;
  return numeric.toFixed(numeric >= 10 ? 0 : 1);
}

function buildVolumeSummaryLine(summary, range) {
  const sessions = summary?.sessions ?? 0;
  const hours = formatHours(summary?.hours);
  const activeDays = summary?.active_days ?? 0;
  const rangeLabel = (summary?.range ?? range).toUpperCase();
  const languageCounts = summary?.by_language ?? {};

  return `${sessions} sessions · ${hours} hours · ${activeDays} active days · ${rangeLabel} · EN ${languageCounts.en ?? 0} / FR ${languageCounts.fr ?? 0} / ES ${languageCounts.es ?? 0}`;
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-secondary)]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-light text-[var(--praxis-text-primary)] tnum">{value}</div>
    </div>
  );
}

function FluencyChart({ series, languageFilter = "all" }) {
  const visibleLanguages = languageFilter === "all" ? LANGUAGE_SERIES : LANGUAGE_SERIES.filter((language) => language.id === languageFilter);
  const points = visibleLanguages.flatMap((language) =>
    (series?.[language.id] ?? []).map((point) => ({
      ...point,
      language: language.id,
      color: language.color,
    })),
  );

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
          Fluency
        </h3>
        <p className="text-sm text-[var(--praxis-text-secondary)] leading-relaxed">
          No fluency scores are available in this range yet.
        </p>
      </div>
    );
  }

  const timestamps = points.map((point) => new Date(point.date).getTime()).filter(Number.isFinite);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const width = 640;
  const height = 240;
  const padding = { top: 22, right: 22, bottom: 30, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  function xFor(date) {
    const time = new Date(date).getTime();
    if (maxTime === minTime) return padding.left + plotWidth / 2;
    return padding.left + ((time - minTime) / (maxTime - minTime)) * plotWidth;
  }

  function yFor(score) {
    return padding.top + (1 - (Number(score) || 0) / 10) * plotHeight;
  }

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Fluency
        </h3>
        <div className="flex items-center gap-3">
          {visibleLanguages.map((language) => (
            <div key={language.id} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: language.color }}
              />
              <span className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                {language.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[240px]"
        role="img"
        aria-label="Fluency score line chart"
      >
        {[0, 2, 4, 6, 8, 10].map((score) => {
          const y = yFor(score);
          return (
            <g key={score}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="var(--praxis-line-subtle)"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 3}
                textAnchor="end"
                className="fill-[var(--praxis-text-secondary)] opacity-40 text-[10px] font-mono"
              >
                {score}
              </text>
            </g>
          );
        })}

        {visibleLanguages.map((language) => {
          const languagePoints = series?.[language.id] ?? [];
          const path = languagePoints
            .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.date)} ${yFor(point.score)}`)
            .join(" ");

          return (
            <g key={language.id}>
              {languagePoints.length > 1 ? (
                <path d={path} fill="none" stroke={language.color} strokeWidth="2.5" />
              ) : null}
              {languagePoints.map((point) => (
                <circle
                  key={`${language.id}-${point.session_id}`}
                  cx={xFor(point.date)}
                  cy={yFor(point.score)}
                  r="4"
                  fill={language.color}
                  stroke="var(--praxis-bg-panel)"
                  strokeWidth="2"
                >
                  <title>
                    {language.label} · {point.date} · {point.score}/10
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function LanguageMixPanel({ summary, analysisSummary }) {
  const counts = summary?.by_language ?? {};
  const total = Math.max(Number(summary?.sessions) || 0, 0);
  const analysisCount = Number(analysisSummary?.sessions) || 0;

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Language Mix
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
          real sessions
        </span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-[var(--praxis-text-secondary)] leading-relaxed">
          No recorded sessions are available in this range.
        </p>
      ) : (
        <div className="space-y-4">
          {LANGUAGE_SERIES.map((language) => {
            const count = Number(counts[language.id]) || 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={language.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: language.color }}
                    />
                    <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                      {language.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--praxis-text-primary)] tnum">
                    {count} · {percent}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--praxis-bg-app)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(percent, count > 0 ? 6 : 0)}%`,
                      backgroundColor: language.color,
                    }}
                  />
                </div>
              </div>
            );
          })}

          <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-3 py-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
              Analysis coverage
            </div>
            <div className="mt-1 text-sm text-[var(--praxis-text-primary)] tnum">
              {analysisCount}/{total} sessions
            </div>
            <div className="mt-1 text-[10px] text-[var(--praxis-text-muted)]">
              Fluency, fillers, and patterns only appear after analysis exists.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PatternTrendList({ patternsByLanguage }) {
  const rows = LANGUAGE_SERIES.flatMap((language) =>
    (patternsByLanguage?.[language.id] ?? []).map((pattern) => ({
      ...pattern,
      language: language.id,
      languageLabel: language.label,
      color: language.color,
    })),
  ).sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
          Recurring Patterns
        </h3>
        <p className="text-sm text-[var(--praxis-text-secondary)] leading-relaxed">
          No recurring pattern hits are available in this range yet.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...rows.map((row) => Number(row.count) || 0), 1);

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Recurring Patterns
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
          {rows.length} tracked
        </span>
      </div>

      <div className="space-y-3">
        {rows.slice(0, 8).map((row) => {
          const widthPercent = Math.max(8, ((Number(row.count) || 0) / maxCount) * 100);
          return (
            <div key={`${row.language}-${row.name}`} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-[var(--praxis-text-primary)]"
                      style={{ backgroundColor: row.color }}
                    >
                      {row.languageLabel}
                    </span>
                    <p className="truncate text-sm font-medium text-[var(--praxis-text-primary)]">{row.name}</p>
                  </div>
                  <div className="mt-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                    {row.trend}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm text-[var(--praxis-text-primary)] tnum">{row.count}</div>
                  <div className="text-[9px] uppercase tracking-widest opacity-35">hits</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[var(--praxis-bg-app)] overflow-hidden">
                <div
                  className="h-full origin-left rounded-full transition-transform duration-[var(--praxis-duration-pane)] ease-[var(--praxis-ease-out)]"
                  style={{ transform: `scaleX(${widthPercent / 100})`, backgroundColor: row.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PatternCalibrationPanel() {
  const [language, setLanguage] = useState("en");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    loadPatterns(language)
      .then((nextPayload) => {
        if (!cancelled) setPayload(nextPayload);
      })
      .catch((caught) => {
        if (!cancelled) {
          setPayload(null);
          setError(caught instanceof Error ? caught.message : "Failed to load recurring patterns.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const patterns = payload?.patterns ?? [];

  async function runCalibration(patternName, nextPayload) {
    const actionKey = `${language}:${patternName}:${nextPayload.action}`;
    setSavingKey(actionKey);
    setError("");
    try {
      const updated = await calibratePattern(language, {
        pattern_name: patternName,
        ...nextPayload,
      });
      setPayload(updated);
      if (nextPayload.action !== "confirm") {
        setDrafts((current) => {
          const next = { ...current };
          delete next[`${language}:${patternName}`];
          return next;
        });
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update pattern.");
    } finally {
      setSavingKey("");
    }
  }

  function getDraft(pattern) {
    return (
      drafts[`${language}:${pattern.name}`] ?? {
        target_name: pattern.name,
        target_description: pattern.description || pattern.name,
      }
    );
  }

  function updateDraft(patternName, patch) {
    const key = `${language}:${patternName}`;
    setDrafts((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        ...patch,
      },
    }));
  }

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
            Pattern Calibration
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-muted)]">
            Confirm useful names, merge duplicates, rename vague hits, or dismiss noise.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {LANGUAGE_SERIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLanguage(option.id)}
              className={`rounded border px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors ${
                language === option.id
                  ? "text-[var(--praxis-text-primary)]"
                  : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-muted)] hover:text-[var(--praxis-text-primary)]"
              }`}
              style={language === option.id ? { backgroundColor: option.color, borderColor: option.color } : undefined}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-widest opacity-50">
          <Loader2 size={14} className="animate-spin text-[var(--praxis-warning)]" />
          Loading pattern memory
        </div>
      ) : error ? (
        <div className="rounded border border-[var(--praxis-danger)]/40 bg-[var(--praxis-danger-soft)] px-4 py-3 text-sm text-[var(--praxis-danger)]">
          {error}
        </div>
      ) : patterns.length === 0 ? (
        <p className="text-sm leading-relaxed text-[var(--praxis-text-muted)]">
          No recurring patterns are stored for this language yet.
        </p>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern) => {
            const draft = getDraft(pattern);
            const busyPrefix = `${language}:${pattern.name}:`;
            const isBusy = savingKey.startsWith(busyPrefix);
            return (
              <div key={`${language}:${pattern.name}`} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[var(--praxis-text-primary)]">{pattern.name}</p>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                        {pattern.count} hits
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest ${
                          pattern.confirmed
                            ? "bg-[var(--praxis-success)]/15 text-[var(--praxis-success)]"
                            : "bg-[var(--praxis-warning)]/15 text-[var(--praxis-warning)]"
                        }`}
                      >
                        {pattern.confirmed ? "confirmed" : "review"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--praxis-text-muted)]">
                      {pattern.description || pattern.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy || pattern.confirmed}
                    onClick={() => void runCalibration(pattern.name, { action: "confirm" })}
                    className="inline-flex items-center gap-2 rounded border border-[var(--praxis-success)]/30 bg-[var(--praxis-success)]/10 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-success)] transition-colors hover:bg-[var(--praxis-success)]/15 disabled:opacity-50"
                  >
                    <Check size={13} />
                    Confirm
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_auto_auto]">
                  <input
                    type="text"
                    value={draft.target_name}
                    onChange={(event) => updateDraft(pattern.name, { target_name: event.target.value })}
                    placeholder="Canonical pattern name"
                    className="min-w-0 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-sm text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-success)]"
                  />
                  <input
                    type="text"
                    value={draft.target_description}
                    onChange={(event) => updateDraft(pattern.name, { target_description: event.target.value })}
                    placeholder="Short explanation"
                    className="min-w-0 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-sm text-[var(--praxis-text-primary)] outline-none focus:border-[var(--praxis-success)]"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void runCalibration(pattern.name, {
                        action: "rename",
                        target_name: draft.target_name,
                        target_description: draft.target_description,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)] transition-colors hover:text-[var(--praxis-text-primary)] disabled:opacity-50"
                  >
                    <Pencil size={13} />
                    Rename
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      void runCalibration(pattern.name, {
                        action: "merge",
                        target_name: draft.target_name,
                        target_description: draft.target_description,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-app)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)] transition-colors hover:text-[var(--praxis-text-primary)] disabled:opacity-50"
                  >
                    <Unlink2 size={13} />
                    Merge
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                    Last seen {pattern.last_seen}
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void runCalibration(pattern.name, { action: "dismiss" })}
                    className="inline-flex items-center gap-2 rounded border border-[var(--praxis-danger)]/25 bg-[var(--praxis-danger-soft)] px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-danger)] transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FillerWordsPanel({ fillerWordsByLanguage }) {
  const sections = LANGUAGE_SERIES.map((language) => ({
    ...language,
    words: fillerWordsByLanguage?.[language.id] ?? [],
  }));
  const totalRows = sections.reduce((count, section) => count + section.words.length, 0);

  if (totalRows === 0) {
    return (
      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
          Filler Words
        </h3>
        <p className="text-sm text-[var(--praxis-text-secondary)] leading-relaxed">
          No filler words are available in this range yet.
        </p>
      </div>
    );
  }

  const maxCount = Math.max(
    ...sections.flatMap((section) => section.words.map((word) => Number(word.count) || 0)),
    1,
  );

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Filler Words
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
          by language
        </span>
      </div>

      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.id}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: section.color }}
              />
              <h4 className="text-[10px] font-mono uppercase tracking-widest opacity-50">
                {section.label}
              </h4>
            </div>

            {section.words.length === 0 ? (
              <p className="text-xs text-[var(--praxis-text-secondary)]">No filler words.</p>
            ) : (
              <div className="space-y-2">
                {section.words.slice(0, 6).map((word) => {
                  const widthPercent = Math.max(8, ((Number(word.count) || 0) / maxCount) * 100);
                  return (
                    <div key={`${section.id}-${word.word}`}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-[var(--praxis-text-primary)] truncate">{word.word}</span>
                        <span className="font-mono text-[var(--praxis-text-primary)] tnum">{word.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-[var(--praxis-bg-app)] overflow-hidden">
                        <div
                          className="h-full origin-left rounded-full transition-transform duration-[var(--praxis-duration-pane)] ease-[var(--praxis-ease-out)]"
                          style={{ transform: `scaleX(${widthPercent / 100})`, backgroundColor: section.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScorecardDimensionsPanel({ dimensions }) {
  const rows = Array.isArray(dimensions) ? dimensions : [];

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
          Improvement Dimensions
        </h3>
        <p className="text-sm text-[var(--praxis-text-secondary)] leading-relaxed">
          New coaching scorecards will appear here after fresh analyses are generated.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Improvement Dimensions
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">
          lowest first
        </span>
      </div>

      <div className="space-y-3">
        {rows.slice(0, 7).map((row) => {
          const average = Number(row.average) || 0;
          const widthPercent = Math.max(6, Math.min(100, average * 10));
          const color = average >= 8 ? "var(--praxis-success)" : "var(--praxis-warning)";
          return (
            <div key={row.metric} className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--praxis-text-primary)]">{row.label}</p>
                  <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">
                    {row.copy || row.trend}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm text-[var(--praxis-text-primary)] tnum">{average.toFixed(1)}</div>
                  <div className="text-[9px] uppercase tracking-widest opacity-35">
                    latest {row.latest ?? "-"}
                  </div>
                </div>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[var(--praxis-bg-app)] overflow-hidden">
                <div
                  className="h-full origin-left rounded-full transition-transform duration-[var(--praxis-duration-pane)] ease-[var(--praxis-ease-out)]"
                  style={{ transform: `scaleX(${widthPercent / 100})`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressFindings({ payload }) {
  const dimensions = payload?.scorecard_dimensions || [];
  const improving = dimensions.find((item) => item.trend === "improving") || dimensions.find((item) => Number(item.average) >= 7);
  const stalled = dimensions.find((item) => item.trend === "slipping") || dimensions.find((item) => Number(item.average) < 6);
  const patterns = Object.values(payload?.pattern_hits_by_language || {}).flat().sort((a, b) => Number(b.count) - Number(a.count));
  const repeated = patterns[0]; const goals = payload?.goal_summary || {}; const volume = payload?.volume_summary || {};
  const enoughEvidence = Number(payload?.analysis_summary?.sessions || 0) >= 3;
  return <section className="border-y border-[var(--praxis-line-subtle)] py-5"><div className="mb-4"><h3 className="text-sm font-semibold text-[var(--praxis-text-primary)]">What the evidence says</h3><p className="mt-1 text-xs text-[var(--praxis-text-muted)]">Written findings first; charts below show the supporting detail.</p></div>{enoughEvidence ? <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">{[["Improving", improving ? `${improving.label}: ${improving.copy || improving.trend}` : "No skill has a clear upward signal yet."], ["Needs attention", stalled ? `${stalled.label}: ${stalled.copy || stalled.trend}` : "No stalled skill detected in this range."], ["Repeated pattern", repeated ? `${repeated.name} appeared in ${repeated.count} analyzed sessions.` : "No repeated pattern has enough evidence yet."], ["Goal follow-through", goals.goal_completion_rate == null ? "Complete more goal cycles to calculate a rate." : `${goals.goal_completion_rate}% of ${goals.goals_total} goals completed.`], ["Recording consistency", `${volume.sessions || 0} sessions across ${volume.active_days || 0} active days.`]].map(([label, text]) => <div key={label}><div className="text-[10px] font-mono uppercase tracking-widest text-[var(--praxis-text-muted)]">{label}</div><p className="mt-1 text-sm leading-6 text-[var(--praxis-text-primary)]">{text}</p></div>)}</div> : <div className="rounded border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] p-4 text-sm leading-6 text-[var(--praxis-text-secondary)]">Not enough data yet. Record 3+ sessions to see reliable trends. {Number(payload?.analysis_summary?.sessions || 0)}/3 analyzed.</div>}</section>;
}

function LinkedTrendSessions({ series, languageFilter, onNavigate }) {
  const languages = languageFilter === "all" ? LANGUAGE_SERIES.map((item) => item.id) : [languageFilter];
  const rows = languages.flatMap((language) => (series?.[language] || []).map((point) => ({ ...point, language }))).filter((point, index, all) => point.session_id && all.findIndex((item) => item.session_id === point.session_id) === index).slice(-8).reverse();
  if (!rows.length) return null;
  return <section><h2 className="mb-2 text-sm font-semibold text-[var(--praxis-text-primary)]">Sessions in this trend</h2><div className="divide-y divide-[var(--praxis-line-subtle)] border-y border-[var(--praxis-line-subtle)]">{rows.map((row) => <button key={row.session_id} type="button" onClick={() => onNavigate?.("session", { sessionId: row.session_id })} className="flex w-full items-center justify-between gap-4 py-2.5 text-left hover:bg-[var(--praxis-bg-hover)]"><span className="font-mono text-[11px] text-[var(--praxis-text-muted)]">{row.date} · {row.language.toUpperCase()}</span><span className="font-mono text-xs text-[var(--praxis-text-primary)]">{row.score}/10</span></button>)}</div></section>;
}

export function Trends({ scrollRef, onNavigate }) {
  const [range, setRange] = useState("30d");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [primaryView, setPrimaryView] = useState("fluency");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    loadTrends(range)
      .then((nextPayload) => {
        if (!cancelled) setPayload(nextPayload);
      })
      .catch((caught) => {
        if (!cancelled) {
          setPayload(null);
          setError(caught instanceof Error ? caught.message : "Failed to load trends.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const summary = payload?.volume_summary;
  const analysisSummary = payload?.analysis_summary;

  function exportProgress() {
    const blob = new Blob([JSON.stringify({ range, language: languageFilter, exported_at: new Date().toISOString(), progress: payload }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `praxis-progress-${range}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--praxis-bg-canvas)]">
      <header className="praxis-glass-chrome flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--praxis-line-subtle)] px-6">
        <div>
          <h1 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Progress</h1>
          <p className="mt-0.5 text-[11px] text-[var(--praxis-text-muted)]">Evidence from completed sessions.</p>
        </div>

        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                range === option.id
                  ? "border-[var(--praxis-accent)] bg-[var(--praxis-selected)] text-[var(--praxis-text-primary)]"
                  : "border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] text-[var(--praxis-text-muted)] hover:text-[var(--praxis-text-primary)]"
              }`}
            >
              {option.label}
            </button>
          ))}
          <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} aria-label="Filter progress by language" className="h-8 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2 text-xs text-[var(--praxis-text-secondary)] outline-none focus:border-[var(--praxis-accent)]"><option value="all">All languages</option><option value="en">English</option><option value="fr">French</option><option value="es">Spanish</option></select>
          <button type="button" onClick={exportProgress} disabled={!payload} className="hidden h-8 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2.5 text-xs text-[var(--praxis-text-secondary)] hover:text-[var(--praxis-text-primary)] disabled:opacity-40 sm:block">Export</button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-12 pt-7">
        {loading ? (
          <div className="mx-auto max-w-6xl space-y-5"><div className="praxis-shimmer h-20 rounded-lg" /><div className="praxis-shimmer h-64 rounded-lg" /></div>
        ) : error ? (
          <div className="flex gap-3 rounded-lg border border-[var(--praxis-danger)]/40 bg-[var(--praxis-danger-soft)] p-5">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--praxis-danger)]" />
            <p className="text-sm text-[var(--praxis-text-primary)]">{error}</p>
          </div>
        ) : (
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <div className="border-y border-[var(--praxis-line-subtle)] py-3">
              <p className="text-[11px] text-[var(--praxis-text-secondary)]">
                {buildVolumeSummaryLine(summary, range)}
              </p>
            </div>

            <ProgressFindings payload={payload} />

            <section>
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[var(--praxis-text-primary)]">Supporting evidence</h2><select value={primaryView} onChange={(event) => setPrimaryView(event.target.value)} aria-label="Choose primary progress view" className="h-8 rounded-md border border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel-raised)] px-2 text-xs text-[var(--praxis-text-secondary)]"><option value="fluency">Fluency trend</option><option value="scorecard">Score dimensions</option></select></div>
                {primaryView === "fluency" ? <FluencyChart series={payload?.fluency_by_language} languageFilter={languageFilter} /> : <ScorecardDimensionsPanel dimensions={payload?.scorecard_dimensions} />}
              </div>
            </section>
            <LinkedTrendSessions series={payload?.fluency_by_language} languageFilter={languageFilter} onNavigate={onNavigate} />
            <details className="border-y border-[var(--praxis-line-subtle)]"><summary className="cursor-pointer py-3 text-sm text-[var(--praxis-text-secondary)]">Patterns and language mix</summary><div className="grid gap-6 pb-5 xl:grid-cols-2"><PatternTrendList patternsByLanguage={payload?.pattern_hits_by_language} /><LanguageMixPanel summary={summary} analysisSummary={analysisSummary} /></div></details>
            <details className="border-b border-[var(--praxis-line-subtle)]"><summary className="cursor-pointer py-3 text-sm text-[var(--praxis-text-secondary)]">Filler words and pattern calibration</summary><div className="grid gap-6 pb-5 xl:grid-cols-2"><FillerWordsPanel fillerWordsByLanguage={payload?.filler_words_by_language} /><PatternCalibrationPanel /></div></details>
          </div>
        )}
      </div>
    </div>
  );
}
