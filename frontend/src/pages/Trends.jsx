import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { loadTrends } from "../api/trends.js";

const RANGE_OPTIONS = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "all", label: "ALL" },
];

const LANGUAGE_SERIES = [
  { id: "en", label: "EN", color: "#4ADE80" },
  { id: "fr", label: "FR", color: "#F27D26" },
  { id: "es", label: "ES", color: "#60A5FA" },
];

function formatHours(value) {
  const numeric = Number(value) || 0;
  return numeric.toFixed(numeric >= 10 ? 0 : 1);
}

function SummaryStat({ label, value }) {
  return (
    <div className="rounded-lg border border-[#2A2C31] bg-[#1C1D21] p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1] opacity-40">
        {label}
      </div>
      <div className="mt-2 text-2xl font-light text-white tnum">{value}</div>
    </div>
  );
}

function PlaceholderPanel({ title, body }) {
  return (
    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
        {title}
      </h3>
      <p className="text-sm text-[#D1D1D1] opacity-70 leading-relaxed">{body}</p>
    </div>
  );
}

function FluencyChart({ series }) {
  const points = LANGUAGE_SERIES.flatMap((language) =>
    (series?.[language.id] ?? []).map((point) => ({
      ...point,
      language: language.id,
      color: language.color,
    })),
  );

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-5">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60 mb-3">
          Fluency
        </h3>
        <p className="text-sm text-[#D1D1D1] opacity-70 leading-relaxed">
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
    <div className="rounded-lg border border-[#2A2C31] bg-[#151619] p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-60">
          Fluency
        </h3>
        <div className="flex items-center gap-3">
          {LANGUAGE_SERIES.map((language) => (
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
                stroke="#2A2C31"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 3}
                textAnchor="end"
                className="fill-[#D1D1D1] opacity-40 text-[10px] font-mono"
              >
                {score}
              </text>
            </g>
          );
        })}

        {LANGUAGE_SERIES.map((language) => {
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
                  stroke="#151619"
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

export function Trends({ scrollRef }) {
  const [range, setRange] = useState("30d");
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-16 border-b border-[#2A2C31] flex items-center px-8 bg-[#151619] shrink-0 justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Trends</h2>
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-40 mt-1">
            progress over time
          </p>
        </div>

        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setRange(option.id)}
              className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                range === option.id
                  ? "bg-[#2A2C31] text-white border border-[#32353B]"
                  : "bg-[#1C1D21] text-[#E0E0E0] border border-[#2A2C31] opacity-60 hover:opacity-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 pb-12 pt-8">
        {loading ? (
          <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-widest opacity-50">
            <Loader2 size={14} className="animate-spin text-[#F27D26]" />
            Loading trends
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-5 flex gap-3">
            <AlertCircle size={16} className="text-red-300 shrink-0 mt-0.5" />
            <p className="text-sm text-red-100">{error}</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryStat label="Sessions" value={summary?.sessions ?? 0} />
              <SummaryStat label="Hours" value={formatHours(summary?.hours)} />
              <SummaryStat label="Active Days" value={summary?.active_days ?? 0} />
              <SummaryStat label="Range" value={(payload?.range ?? range).toUpperCase()} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <FluencyChart series={payload?.fluency_by_language} />
              <PlaceholderPanel
                title="Recurring Patterns"
                body="Pattern counts and trend labels are loaded. The visual list renders in the next task."
              />
              <PlaceholderPanel
                title="Filler Words"
                body="Filler-word totals are loaded by language and range."
              />
              <PlaceholderPanel
                title="Language Mix"
                body={`EN ${summary?.by_language?.en ?? 0} · FR ${summary?.by_language?.fr ?? 0} · ES ${summary?.by_language?.es ?? 0}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
