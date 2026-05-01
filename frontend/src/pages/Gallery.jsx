import { Filter, PlayCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getSessionThumbnailUrl } from "../api/sessions.js";
import { useIndex } from "../hooks/useIndex.js";
import { groupGallerySessionsByMonth } from "../lib/gallery.js";
import {
  formatDuration,
  formatShortDate,
  getSessionTitle,
  getStatusBadgeStyle,
  getStatusLabel,
} from "../lib/sessionUi.js";

const LANG_FILTERS = [
  { id: "all", label: "All" },
  { id: "en", label: "EN" },
  { id: "fr", label: "FR" },
  { id: "es", label: "ES" },
];

function GalleryThumbnail({ sessionId }) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return <PlayCircle size={32} className="text-[#E0E0E0] opacity-50 group-hover:opacity-100 transition-opacity" />;
  }

  return (
    <img
      src={getSessionThumbnailUrl(sessionId)}
      alt=""
      className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
      onError={() => setErrored(true)}
    />
  );
}

export function Gallery({ onNavigate }) {
  const { index, isLoading } = useIndex();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const sessions = index?.sessions ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (langFilter !== "all" && s.language !== langFilter) return false;
      if (q && !getSessionTitle(s).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sessions, search, langFilter]);
  const groupedSessions = useMemo(() => groupGallerySessionsByMonth(filtered), [filtered]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-16 border-b border-[#2A2C31] flex items-center px-8 bg-[#151619] shrink-0 justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight text-white">Gallery</h2>

        <div className="flex gap-3 items-center">
          <div className="relative w-[280px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
              size={14}
            />
            <input
              type="text"
              placeholder="Search past sessions..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-[#1C1D21] border border-[#2A2C31] rounded pl-9 pr-3 py-1.5 text-xs text-[#E0E0E0] placeholder:text-neutral-500 focus:outline-none focus:border-[#4ADE80] transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`px-3 py-1.5 border rounded flex items-center gap-2 text-xs font-semibold uppercase tracking-widest transition-colors ${
              showFilters
                ? "bg-[#2A2C31] border-[#32353B] text-white"
                : "bg-[#1C1D21] border-[#2A2C31] text-[#E0E0E0] hover:bg-[#2A2C31]"
            }`}
          >
            <Filter size={14} /> Filters
          </button>
        </div>
      </header>

      {showFilters ? (
        <div className="border-b border-[#2A2C31] bg-[#0F1012] px-8 py-3 flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest opacity-50 mr-2">
            Language
          </span>
          {LANG_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setLangFilter(option.id)}
              className={`px-3 py-1 rounded text-[10px] font-mono uppercase tracking-widest transition-colors ${
                langFilter === option.id
                  ? "bg-[#2A2C31] text-white"
                  : "bg-[#1C1D21] text-[#E0E0E0] opacity-60 hover:opacity-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto px-8 pb-12 pt-8">
        {isLoading && sessions.length === 0 ? (
          <div className="text-[11px] font-mono opacity-50 uppercase tracking-widest">
            Loading sessions…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-[11px] font-mono opacity-50 uppercase tracking-widest">
            {sessions.length === 0
              ? "No sessions yet. Go record one."
              : "No sessions match these filters."}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {groupedSessions.map((group) => (
              <section key={group.label} className="flex flex-col gap-4">
                <h3 className="text-[10px] font-mono lowercase tracking-[0.24em] text-[#D1D1D1] opacity-50">
                  {group.label}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {group.sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => onNavigate("session", { sessionId: session.id })}
                      className="bg-[#1C1D21] border border-[#2A2C31] rounded-lg overflow-hidden cursor-pointer hover:border-[#4ADE80]/50 transition-colors group flex flex-col text-left"
                    >
                      <div className="aspect-video bg-[#0A0B0D] relative flex items-center justify-center border-b border-[#2A2C31] overflow-hidden">
                        <GalleryThumbnail sessionId={session.id} />
                        <div className="absolute bottom-2 right-2 bg-[#151619]/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-mono text-[#E0E0E0] border border-[#2A2C31]">
                          {formatDuration(session.duration_seconds)}
                        </div>
                        {!session.read ? (
                          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                        ) : null}
                      </div>

                      <div className="p-4 flex flex-col gap-2 flex-1">
                        <h3 className="font-semibold text-white truncate text-sm">
                          {getSessionTitle(session)}
                        </h3>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[10px] font-mono opacity-50">
                            {formatShortDate(session.created_at)}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase tracking-widest ${getStatusBadgeStyle(
                              session.status,
                            )}`}
                          >
                            {getStatusLabel(session.status)}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
