import { useEffect, useMemo, useState } from "react";
import { useIndex } from "../hooks/useIndex.js";
import { groupGallerySessionsByMonth } from "../lib/gallery.js";
import { SessionBrowser } from "../components/praxis/SessionBrowser.jsx";
import { getSessionTitle } from "../lib/sessionUi.js";

export function Gallery({ onNavigate, scrollRef }) {
  const { index, isLoading } = useIndex();
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState(() => window.localStorage.getItem("praxis.sessions.language") || "all");
  const [statusFilter, setStatusFilter] = useState(() => window.localStorage.getItem("praxis.sessions.status") || "all");
  const [dateRange, setDateRange] = useState(() => window.localStorage.getItem("praxis.sessions.range") || "all");
  const [sort, setSort] = useState(() => window.localStorage.getItem("praxis.sessions.sort") || "newest");

  const sessions = index?.sessions ?? [];

  useEffect(() => window.localStorage.setItem("praxis.sessions.status", statusFilter), [statusFilter]);
  useEffect(() => window.localStorage.setItem("praxis.sessions.language", langFilter), [langFilter]);
  useEffect(() => window.localStorage.setItem("praxis.sessions.range", dateRange), [dateRange]);
  useEffect(() => window.localStorage.setItem("praxis.sessions.sort", sort), [sort]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const rangeDays = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : null;
    return sessions.filter((s) => {
      if (langFilter !== "all" && s.language !== langFilter) return false;
      if (statusFilter === "processing" && !["queued", "transcribing", "analyzing"].includes(s.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "processing" && s.status !== statusFilter) return false;
      if (rangeDays && now - new Date(s.created_at).getTime() > rangeDays * 86400000) return false;
      if (q && !getSessionTitle(s).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => sort === "oldest" ? new Date(a.created_at) - new Date(b.created_at) : new Date(b.created_at) - new Date(a.created_at));
  }, [sessions, search, langFilter, statusFilter, dateRange, sort]);
  const groupedSessions = useMemo(() => groupGallerySessionsByMonth(filtered), [filtered]);

  return (
    <SessionBrowser
      sessions={filtered}
      groups={groupedSessions}
      search={search}
      onSearch={setSearch}
      langFilter={langFilter}
      onLangFilter={setLangFilter}
      statusFilter={statusFilter}
      onStatusFilter={setStatusFilter}
      dateRange={dateRange}
      onDateRange={setDateRange}
      sort={sort}
      onSort={setSort}
      onClearFilters={() => { setSearch(""); setLangFilter("all"); setStatusFilter("all"); setDateRange("all"); }}
      onNavigate={onNavigate}
      isLoading={isLoading}
      hasArchiveSessions={sessions.length > 0}
    />
  );
}
