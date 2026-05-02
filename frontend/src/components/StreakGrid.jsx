import { useState } from "react";

const DAY_MS = 24 * 60 * 60 * 1000;
const QUALIFYING_SESSION_SECONDS = 120;

const INTENSITY_CLASSES = [
  "bg-[#1C1D21] border-[#2A2C31]",
  "bg-[#3A2A1F] border-[#5A3A25]",
  "bg-[#7A431F] border-[#9A5425]",
  "bg-[#F27D26] border-[#F4B26D] shadow-[0_0_10px_rgba(242,125,38,0.22)]",
  "bg-[#4ADE80] border-[#7AF0A2] shadow-[0_0_12px_rgba(74,222,128,0.24)]",
];

function toLocalDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIntensity(totalSeconds) {
  if (totalSeconds < QUALIFYING_SESSION_SECONDS) return 0;
  if (totalSeconds < 10 * 60) return 1;
  if (totalSeconds < 25 * 60) return 2;
  if (totalSeconds < 45 * 60) return 3;
  return 4;
}

function buildDayBuckets(sessions) {
  const buckets = new Map();

  for (const session of sessions ?? []) {
    const durationSeconds = Number(session.duration_seconds) || 0;
    if (durationSeconds < QUALIFYING_SESSION_SECONDS) continue;

    const key = toLocalDateKey(session.created_at);
    if (!key) continue;

    const current = buckets.get(key) ?? { count: 0, totalSeconds: 0 };
    buckets.set(key, {
      count: current.count + 1,
      totalSeconds: current.totalSeconds + durationSeconds,
    });
  }

  return buckets;
}

function buildGridDays(sessions, endDate) {
  const buckets = buildDayBuckets(sessions);
  const end = new Date(endDate);
  end.setHours(12, 0, 0, 0);
  const days = [];

  for (let offset = 364; offset >= 0; offset -= 1) {
    const day = new Date(end.getTime() - offset * DAY_MS);
    const key = dateKeyFromDate(day);
    const bucket = buckets.get(key) ?? { count: 0, totalSeconds: 0 };
    days.push({
      key,
      count: bucket.count,
      totalSeconds: bucket.totalSeconds,
      intensity: getIntensity(bucket.totalSeconds),
      isToday: key === dateKeyFromDate(new Date()),
    });
  }

  return days;
}

function formatSummary(day) {
  if (!day) return "Hover a day to inspect practice activity.";

  const minutes = Math.round(day.totalSeconds / 60);
  if (day.count === 0) {
    return `${day.key} · no qualifying practice`;
  }

  const sessionLabel = day.count === 1 ? "session" : "sessions";
  return `${day.key} · ${day.count} ${sessionLabel} · ${minutes} min`;
}

export function StreakGrid({ sessions, endDate = new Date() }) {
  const days = buildGridDays(sessions, endDate);
  const [activeDay, setActiveDay] = useState(null);
  const activeCount = days.filter((day) => day.intensity > 0).length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-h-4 text-[10px] font-mono uppercase tracking-widest text-[#D1D1D1]/50">
          {formatSummary(activeDay)}
        </div>
        <div className="shrink-0 text-[9px] font-mono uppercase tracking-widest text-[#4ADE80]/80">
          {activeCount} active days
        </div>
      </div>
      <div className="overflow-x-auto pb-1" onMouseLeave={() => setActiveDay(null)}>
        <div
          className="grid grid-flow-col grid-rows-7 gap-[3px] w-max"
          aria-label="365 day streak activity grid"
        >
          {days.map((day, index) => (
            <button
              key={day.key}
              type="button"
              onMouseEnter={() => setActiveDay(day)}
              onFocus={() => setActiveDay(day)}
              onBlur={() => setActiveDay(null)}
              className={`streak-cell h-2.5 w-2.5 rounded-[2px] border outline-none transition-transform hover:scale-125 focus:scale-125 focus:ring-1 focus:ring-[#D1D1D1]/40 ${
                day.isToday ? "ring-1 ring-[#D1D1D1]/50" : ""
              } ${day.intensity > 0 ? "streak-cell-active" : ""} ${INTENSITY_CLASSES[day.intensity]}`}
              style={{ animationDelay: `${Math.min(index, 60) * 8}ms` }}
              title={`${day.key}: ${day.count} qualifying session${day.count === 1 ? "" : "s"}`}
              aria-label={formatSummary(day)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-[#D1D1D1]/40">
          <span>less</span>
          <div className="flex gap-[3px]">
            {INTENSITY_CLASSES.map((className, index) => (
              <span
                key={className}
                className={`h-2.5 w-2.5 rounded-[2px] border ${className}`}
                aria-label={`intensity ${index}`}
              />
            ))}
          </div>
          <span>more</span>
        </div>
      </div>
    </div>
  );
}
