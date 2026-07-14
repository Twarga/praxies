import { useMemo } from "react";
import { TimelineStrip } from "./TimelineStrip.jsx";

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }
function formatTimestamp(value) { const seconds = Math.max(0, Math.floor(Number(value) || 0)); return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function fallbackBars(segments, count = 72) {
  return Array.from({ length: count }, (_, index) => {
    const segment = segments?.[index % Math.max(1, segments.length)];
    return clamp01(0.2 + (((segment?.text?.length || index * 7) % 29) / 29) * 0.75);
  });
}

export function SessionWaveform({ bars, segments = [], evidence = [], currentTime, duration, onSeek }) {
  const waveformBars = useMemo(() => bars?.length ? bars.map(clamp01) : fallbackBars(segments), [bars, segments]);
  const displayedDuration = Math.max(Number(duration) || 0, Number(segments.at(-1)?.end_seconds) || 0);
  return <div className="border-y border-[var(--praxis-line-subtle)] bg-[var(--praxis-bg-panel)] px-3 py-2"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-mono text-[var(--praxis-text-muted)]">Timeline</span><span className="font-mono text-[10px] tabular-nums text-[var(--praxis-text-muted)]">{formatTimestamp(currentTime)} / {formatTimestamp(displayedDuration)}</span></div><TimelineStrip bars={waveformBars} markers={evidence} currentTime={currentTime} duration={displayedDuration} onSeek={onSeek} /></div>;
}
