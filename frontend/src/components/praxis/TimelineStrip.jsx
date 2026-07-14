import { useMemo } from "react";
import { EvidenceMarker } from "./EvidenceMarker.jsx";
import { cn } from "../../lib/cn.js";

const SIZE_CLASSES = { full: "h-8", medium: "h-7", tiny: "h-5" };

function clamp01(value) { return Math.max(0, Math.min(1, Number(value) || 0)); }

export function TimelineStrip({ bars = [], markers = [], currentTime = 0, duration = 0, onSeek, size = "full", className }) {
  const safeDuration = Math.max(0, Number(duration) || 0);
  const played = safeDuration ? clamp01(currentTime / safeDuration) : 0;
  const normalizedBars = useMemo(() => (bars.length ? bars : Array.from({ length: 72 }, (_, index) => 0.22 + (index % 7) * 0.08)).map(clamp01), [bars]);
  return (
    <div className={cn("praxis-timeline-strip group", SIZE_CLASSES[size] || SIZE_CLASSES.full, className)}>
      <button type="button" aria-label="Seek recording timeline" className="absolute inset-0 flex w-full items-center gap-px px-1" onClick={(event) => {
        if (!safeDuration) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        onSeek?.(clamp01((event.clientX - bounds.left) / Math.max(1, bounds.width)) * safeDuration);
      }}>
        {normalizedBars.map((height, index) => <span key={index} className={cn("min-w-px flex-1 rounded-full", (index + 0.5) / normalizedBars.length <= played ? "bg-[var(--praxis-text-primary)]" : "bg-[var(--praxis-text-muted)]")} style={{ height: `${24 + height * 70}%`, opacity: (index + 0.5) / normalizedBars.length <= played ? 0.9 : 0.42 }} />)}
      </button>
      {markers.map((marker, index) => <EvidenceMarker key={`${marker.timestamp_seconds ?? marker.timestamp}-${index}`} timestamp={marker.timestamp_seconds ?? marker.timestamp} duration={safeDuration} kind={marker.kind || marker.type} label={marker.label} onSeek={onSeek} />)}
      <span className="pointer-events-none absolute inset-y-0 z-20 w-px bg-[var(--praxis-accent)]" style={{ left: `${played * 100}%` }} />
    </div>
  );
}
